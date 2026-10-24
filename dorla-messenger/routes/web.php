<?php

use App\Http\Controllers\Admin\AdminDashboardController;
use App\Http\Controllers\Admin\AdminDeletionRequestController;
use App\Http\Controllers\Admin\AdminPageController;
use App\Http\Controllers\Admin\AdminSettingController;
use App\Http\Controllers\Admin\AdminSystemController;
use App\Http\Controllers\Admin\AdminUserController;
use App\Http\Controllers\Account\BusinessSettingsController;
use App\Http\Controllers\Account\DataDeletionRequestController;
use App\Http\Controllers\Account\PasswordController;
use App\Http\Controllers\Account\ProfileController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\Auth\EmailVerificationController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\NewPasswordController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\AutomationController;
use App\Http\Controllers\BroadcastController;
use App\Http\Controllers\ClickTrackingController;
use App\Http\Controllers\CommentAutomationController;
use App\Http\Controllers\ContactController;
use App\Http\Controllers\Customer\DashboardController;
use App\Http\Controllers\FacebookPageController;
use App\Http\Controllers\MetaOAuthController;
use App\Http\Controllers\MetaWebhookController;
use App\Http\Controllers\MessengerContactController;
use App\Http\Controllers\PublicSite\AboutController;
use App\Http\Controllers\PublicSite\ContactFormController;
use App\Http\Controllers\PublicSite\DataDeletionInfoController;
use App\Http\Controllers\PublicSite\HomeController;
use App\Http\Controllers\PublicSite\PricingController;
use App\Http\Controllers\PublicSite\PrivacyPolicyController;
use App\Http\Controllers\PublicSite\TermsController;
use App\Http\Controllers\SimulatorController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public marketing website
|--------------------------------------------------------------------------
*/
Route::get('/', HomeController::class)->name('home');
Route::get('/about', AboutController::class)->name('about');
Route::get('/pricing', PricingController::class)->name('pricing');
Route::get('/privacy-policy', PrivacyPolicyController::class)->name('privacy');
Route::get('/terms-of-service', TermsController::class)->name('terms');
Route::get('/data-deletion', DataDeletionInfoController::class)->name('data-deletion');
Route::get('/contact', [ContactFormController::class, 'show'])->name('contact');
Route::post('/contact', [ContactFormController::class, 'submit'])
    ->middleware('throttle:5,1')->name('contact.submit');

/*
|--------------------------------------------------------------------------
| Meta webhooks (public, signature-verified, CSRF-exempt)
|--------------------------------------------------------------------------
*/
Route::get('/webhooks/meta/messenger', [MetaWebhookController::class, 'verify']);
Route::post('/webhooks/meta/messenger', [MetaWebhookController::class, 'receive'])
    ->middleware('throttle:120,1');

/*
|--------------------------------------------------------------------------
| First-party click tracking links (public, 302 redirect)
|--------------------------------------------------------------------------
*/
Route::get('/c/{trackingCode}', ClickTrackingController::class)
    ->name('tracking.click')->middleware('throttle:60,1');

/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/
Route::middleware('guest')->group(function (): void {
    Route::get('/register', [RegisterController::class, 'create'])->name('register');
    Route::post('/register', [RegisterController::class, 'store'])
        ->middleware('throttle:10,1')->name('register.store');

    Route::get('/login', [LoginController::class, 'create'])->name('login');
    Route::post('/login', [LoginController::class, 'store'])
        ->middleware('throttle:6,1')->name('login.store');

    Route::get('/forgot-password', [PasswordResetLinkController::class, 'create'])->name('password.request');
    Route::post('/forgot-password', [PasswordResetLinkController::class, 'store'])
        ->middleware('throttle:5,1')->name('password.email');

    Route::get('/reset-password/{token}', [NewPasswordController::class, 'create'])->name('password.reset');
    Route::post('/reset-password', [NewPasswordController::class, 'store'])
        ->middleware('throttle:5,1')->name('password.update');
});

Route::middleware('auth')->group(function (): void {
    Route::post('/logout', [LoginController::class, 'destroy'])->name('logout');

    Route::get('/verify-email', [EmailVerificationController::class, 'notice'])->name('verification.notice');
    Route::get('/verify-email/{id}/{hash}', [EmailVerificationController::class, 'verify'])
        ->middleware(['signed', 'throttle:6,1'])->name('verification.verify');
    Route::post('/email/verification-notification', [EmailVerificationController::class, 'resend'])
        ->middleware('throttle:3,1')->name('verification.send');
});

/*
|--------------------------------------------------------------------------
| Customer dashboard (authenticated, active accounts only)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth', 'user.active'])->group(function (): void {

    Route::get('/dashboard', DashboardController::class)->name('dashboard');

    // --- Meta OAuth flow ---
    Route::get('/auth/meta/redirect', [MetaOAuthController::class, 'redirect'])
        ->name('meta.redirect');
    Route::get('/auth/meta/callback', [MetaOAuthController::class, 'callback'])
        ->name('meta.callback');
    Route::post('/pages/connect/{metaPageId}', [MetaOAuthController::class, 'connectPage'])
        ->where('metaPageId', '[0-9]+')->name('meta.connect-page');

    // --- Connected Pages ---
    Route::get('/pages', [FacebookPageController::class, 'index'])->name('pages.index');
    Route::post('/pages/{facebookPage}/connect', [FacebookPageController::class, 'connect'])
        ->name('pages.connect');
    Route::post('/pages/{facebookPage}/refresh', [FacebookPageController::class, 'refresh'])
        ->name('pages.refresh');
    Route::delete('/pages/{facebookPage}', [FacebookPageController::class, 'destroy'])
        ->name('pages.destroy');
    Route::get('/pages/{facebookPage}/posts', [FacebookPageController::class, 'posts'])
        ->name('pages.posts');

    // --- Automations (welcome / default reply / keyword rules) ---
    Route::get('/automations', [AutomationController::class, 'index'])->name('automations.index');
    Route::get('/automations/create', [AutomationController::class, 'create'])->name('automations.create');
    Route::post('/automations', [AutomationController::class, 'store'])->name('automations.store');
    Route::get('/automations/{automationRule}/edit', [AutomationController::class, 'edit'])->name('automations.edit');
    Route::put('/automations/{automationRule}', [AutomationController::class, 'update'])->name('automations.update');
    Route::delete('/automations/{automationRule}', [AutomationController::class, 'destroy'])->name('automations.destroy');
    Route::post('/automations/{automationRule}/toggle', [AutomationController::class, 'toggle'])->name('automations.toggle');
    Route::post('/automations/{automationRule}/test', [AutomationController::class, 'test'])
        ->name('automations.test');

    // --- Comment-to-Messenger automations ---
    Route::get('/comment-automations', [CommentAutomationController::class, 'index'])->name('comment-automations.index');
    Route::get('/comment-automations/create', [CommentAutomationController::class, 'create'])->name('comment-automations.create');
    Route::post('/comment-automations', [CommentAutomationController::class, 'store'])->name('comment-automations.store');
    Route::get('/comment-automations/{automationRule}/edit', [CommentAutomationController::class, 'edit'])->name('comment-automations.edit');
    Route::put('/comment-automations/{automationRule}', [CommentAutomationController::class, 'update'])->name('comment-automations.update');
    Route::delete('/comment-automations/{automationRule}', [CommentAutomationController::class, 'destroy'])->name('comment-automations.destroy');
    Route::post('/comment-automations/{automationRule}/toggle', [CommentAutomationController::class, 'toggle'])->name('comment-automations.toggle');

    // --- Contacts ---
    Route::get('/contacts', [MessengerContactController::class, 'index'])->name('contacts.index');
    Route::get('/contacts/export', [MessengerContactController::class, 'export'])->name('contacts.export');
    Route::get('/contacts/{messengerContact}', [MessengerContactController::class, 'show'])->name('contacts.show');
    Route::post('/contacts/{messengerContact}/tags', [MessengerContactController::class, 'attachTag'])->name('contacts.tags.attach');
    Route::delete('/contacts/{messengerContact}/tags/{contactTag}', [MessengerContactController::class, 'detachTag'])->name('contacts.tags.detach');
    Route::delete('/contacts/{messengerContact}', [MessengerContactController::class, 'destroy'])->name('contacts.destroy');

    // --- Broadcasts ---
    Route::get('/broadcasts', [BroadcastController::class, 'index'])->name('broadcasts.index');
    Route::get('/broadcasts/create', [BroadcastController::class, 'create'])->name('broadcasts.create');
    Route::post('/broadcasts/preview', [BroadcastController::class, 'preview'])->name('broadcasts.preview');
    Route::post('/broadcasts/test', [BroadcastController::class, 'sendTest'])->name('broadcasts.test');
    Route::post('/broadcasts', [BroadcastController::class, 'store'])->name('broadcasts.store');
    Route::get('/broadcasts/{broadcast}', [BroadcastController::class, 'show'])->name('broadcasts.show');
    Route::delete('/broadcasts/{broadcast}', [BroadcastController::class, 'destroy'])->name('broadcasts.destroy');
    Route::post('/broadcasts/{broadcast}/pause', [BroadcastController::class, 'pause'])->name('broadcasts.pause');
    Route::post('/broadcasts/{broadcast}/resume', [BroadcastController::class, 'resume'])->name('broadcasts.resume');
    Route::post('/broadcasts/{broadcast}/cancel', [BroadcastController::class, 'cancel'])->name('broadcasts.cancel');

    // --- Analytics ---
    Route::get('/analytics', [AnalyticsController::class, 'index'])->name('analytics');

    // --- Account settings ---
    Route::get('/settings/profile', [ProfileController::class, 'edit'])->name('settings.profile');
    Route::put('/settings/profile', [ProfileController::class, 'update'])->name('settings.profile.update');
    Route::get('/settings/password', [PasswordController::class, 'edit'])->name('settings.password');
    Route::put('/settings/password', [PasswordController::class, 'update'])->name('settings.password.update');
    Route::get('/settings/business', [BusinessSettingsController::class, 'edit'])->name('settings.business');
    Route::put('/settings/business', [BusinessSettingsController::class, 'update'])->name('settings.business.update');
    Route::get('/settings/data-deletion', [DataDeletionRequestController::class, 'create'])->name('settings.data-deletion');
    Route::post('/settings/data-deletion', [DataDeletionRequestController::class, 'store'])->name('settings.data-deletion.store');

    // --- Development simulator (simulation mode only) ---
    Route::middleware('meta.simulation')->group(function (): void {
        Route::get('/simulator', [SimulatorController::class, 'index'])->name('simulator.index');
        Route::post('/simulator/meta-event', [SimulatorController::class, 'dispatchEvent'])
            ->name('simulator.dispatch');
    });
});

/*
|--------------------------------------------------------------------------
| Super-admin area (dedicated role, server-side guarded)
|--------------------------------------------------------------------------
*/
Route::prefix('admin')->name('admin.')
    ->middleware(['auth', 'user.active', 'super.admin'])
    ->group(function (): void {

        Route::get('/', AdminDashboardController::class)->name('dashboard');

        Route::get('/users', [AdminUserController::class, 'index'])->name('users.index');
        Route::get('/users/{user}', [AdminUserController::class, 'show'])->name('users.show');
        Route::post('/users/{user}/suspend', [AdminUserController::class, 'suspend'])->name('users.suspend');
        Route::post('/users/{user}/activate', [AdminUserController::class, 'activate'])->name('users.activate');
        Route::post('/users/{user}/password-reset', [AdminUserController::class, 'sendPasswordReset'])->name('users.password-reset');
        Route::post('/users/{user}/notes', [AdminUserController::class, 'addNote'])->name('users.notes');
        Route::put('/users/{user}/limits', [AdminUserController::class, 'updateLimits'])->name('users.limits');

        Route::get('/pages', [AdminPageController::class, 'index'])->name('pages.index');
        Route::post('/pages/{facebookPage}/toggle', [AdminPageController::class, 'toggle'])->name('pages.toggle');

        Route::get('/settings', [AdminSettingController::class, 'edit'])->name('settings.edit');
        Route::put('/settings', [AdminSettingController::class, 'update'])->name('settings.update');

        Route::get('/logs', [AdminSystemController::class, 'logs'])->name('logs');
        Route::get('/failed-jobs', [AdminSystemController::class, 'failedJobs'])->name('failed-jobs');
        Route::post('/failed-jobs/{uuid}/retry', [AdminSystemController::class, 'retryJob'])->name('failed-jobs.retry');
        Route::delete('/failed-jobs/{uuid}', [AdminSystemController::class, 'deleteJob'])->name('failed-jobs.delete');

        Route::get('/deletion-requests', [AdminDeletionRequestController::class, 'index'])->name('deletion-requests.index');
        Route::post('/deletion-requests/{dataDeletionRequest}/process', [AdminDeletionRequestController::class, 'process'])->name('deletion-requests.process');
    });
