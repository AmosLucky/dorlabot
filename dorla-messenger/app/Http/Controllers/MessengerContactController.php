<?php

namespace App\Http\Controllers;

use App\Models\ContactTag;
use App\Models\MessengerContact;
use App\Services\TenantContextService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\View\View;

class MessengerContactController extends Controller
{
    public function __construct(
        private readonly TenantContextService $tenant,
    ) {}

    public function index(Request $request): View
    {
        $user = $request->user();

        $contacts = MessengerContact::where('messenger_contacts.user_id', $user->id)
            ->with(['page:id,name', 'tags:id,name,color'])
            ->when($request->filled('q'), fn ($q) => $q->search($request->string('q')))
            ->when($request->filled('page'), fn ($q) => $q->where('facebook_page_id', (int) $request->input('page')))
            ->when($request->filled('tag'), fn ($q) => $q->whereHas(
                'tags', fn ($t) => $t->where('contact_tags.id', (int) $request->input('tag'))
            ))
            ->when($request->filled('interacted_after'), fn ($q) => $q->where(
                'last_interaction_at', '>=', Carbon::parse((string) $request->input('interacted_after'))->startOfDay()
            ))
            ->orderByDesc('last_interaction_at')
            ->paginate(20)
            ->withQueryString();

        return view('contacts.index', [
            'contacts' => $contacts,
            'pages' => $user->facebookPages()->orderBy('name')->get(['id', 'name']),
            'tags' => ContactTag::where('user_id', $user->id)->orderBy('name')->get(),
        ]);
    }

    public function show(Request $request, MessengerContact $messengerContact): View
    {
        $this->authorizeContact($request, $messengerContact);

        $messages = $messengerContact->messageEvents()
            ->orderByDesc('occurred_at')->limit(50)->get()->reverse();

        return view('contacts.show', [
            'contact' => $messengerContact->load(['page', 'tags', 'customFields', 'optIns']),
            'messages' => $messages,
            'executions' => $messengerContact->hasMany(\App\Models\AutomationExecution::class)->with('rule')->orderByDesc('id')->limit(10)->get(),
        ]);
    }

    public function attachTag(Request $request, MessengerContact $messengerContact): RedirectResponse
    {
        $this->authorizeContact($request, $messengerContact);

        $validated = $request->validate(['tag_name' => ['required', 'string', 'max:60']]);

        $tag = ContactTag::firstOrCreate(
            ['user_id' => $request->user()->id, 'name' => $validated['tag_name']],
            ['color' => 'primary'],
        );

        $messengerContact->tags()->syncWithoutDetaching([$tag->id]);

        return back()->with('success', 'Tag "'.$tag->name.'" added.');
    }

    public function detachTag(Request $request, MessengerContact $messengerContact, ContactTag $contactTag): RedirectResponse
    {
        $this->authorizeContact($request, $messengerContact);

        if ((int) $contactTag->user_id !== (int) $request->user()->id) {
            abort(404);
        }

        $messengerContact->tags()->detach([$contactTag->id]);

        return back()->with('success', 'Tag "'.$contactTag->name.'" removed.');
    }

    /**
     * Hard-delete a contact and their personal data (messages history rows
     * are anonymized/deleted via FK cascade).
     */
    public function destroy(Request $request, MessengerContact $messengerContact): RedirectResponse
    {
        $this->authorizeContact($request, $messengerContact);

        $messengerContact->messageEvents()->delete();
        $messengerContact->executions()->delete();
        $messengerContact->optIns()->delete();
        $messengerContact->customFields()->delete();
        $messengerContact->tags()->detach();
        $messengerContact->forceDelete();

        return redirect()->route('contacts.index')
            ->with('success', 'Contact deleted along with their message history.');
    }

    /**
     * CSV export of the tenant's own authorized contact data only.
     */
    public function export(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $user = $request->user();

        $filename = 'contacts-'.now()->format('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($user): void {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['psid', 'first_name', 'last_name', 'page', 'source', 'tags', 'first_interaction', 'last_interaction', 'opted_in']);

            MessengerContact::where('user_id', $user->id)
                ->with(['page:id,name', 'tags:id,name'])
                ->chunkById(500, function ($contacts) use ($out): void {
                    foreach ($contacts as $c) {
                        fputcsv($out, [
                            $c->psid,
                            $c->first_name,
                            $c->last_name,
                            $c->page?->name,
                            $c->source,
                            $c->tags->pluck('name')->implode('|'),
                            $c->first_interaction_at?->toDateTimeString(),
                            $c->last_interaction_at?->toDateTimeString(),
                            $c->opted_in_notifications ? 'yes' : 'no',
                        ]);
                    }
                });

            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    protected function authorizeContact(Request $request, MessengerContact $contact): void
    {
        if ((int) $contact->user_id !== (int) $request->user()->id) {
            abort(404);
        }
    }
}
