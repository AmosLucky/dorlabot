<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_tags', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 60);
            $table->string('color', 20)->default('primary');
            $table->timestamps();

            $table->unique(['user_id', 'name']);
        });

        Schema::create('messenger_contacts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();          // tenant owner
            $table->foreignId('facebook_page_id')->constrained()->cascadeOnDelete(); // owning Page
            $table->string('psid', 128)->index();                 // Meta page-scoped ID
            $table->string('first_name', 100)->nullable();
            $table->string('last_name', 100)->nullable();
            $table->string('locale', 20)->nullable();
            $table->string('timezone_offset', 10)->nullable();
            $table->string('source', 40)->default('dm')->index(); // dm|comment_reply|postback|broadcast|import
            $table->json('meta_profile')->nullable();             // permitted fields only
            $table->timestamp('first_interaction_at')->nullable();
            $table->timestamp('last_interaction_at')->nullable()->index();
            $table->timestamp('last_messaged_at')->nullable();    // last OUTBOUND message from us
            $table->timestamp('last_user_message_at')->nullable(); // last INBOUND (opens 24h window)
            $table->boolean('opted_in_notifications')->default(false);
            $table->timestamp('opted_in_at')->nullable();
            $table->softDeletes();
            $table->timestamps();

            $table->unique(['facebook_page_id', 'psid']);
            $table->index(['user_id', 'last_interaction_at']);
        });

        Schema::create('contact_tag_assignments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('messenger_contact_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contact_tag_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['messenger_contact_id', 'contact_tag_id']);
        });

        Schema::create('contact_custom_fields', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('messenger_contact_id')->constrained()->cascadeOnDelete();
            $table->string('field_key', 60)->index();
            $table->string('field_value', 500)->nullable();
            $table->timestamps();

            $table->unique(['messenger_contact_id', 'field_key']);
        });

        Schema::create('notification_opt_ins', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('facebook_page_id')->constrained()->cascadeOnDelete();
            $table->foreignId('messenger_contact_id')->constrained()->cascadeOnDelete();
            $table->string('topic', 100)->default('general');
            $table->string('source', 40)->default('postback'); // opt-in entry point
            $table->timestamp('opted_in_at');
            $table->timestamp('opted_out_at')->nullable();
            $table->timestamps();

            $table->index(['messenger_contact_id', 'topic']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_opt_ins');
        Schema::dropIfExists('contact_custom_fields');
        Schema::dropIfExists('contact_tag_assignments');
        Schema::dropIfExists('messenger_contacts');
        Schema::dropIfExists('contact_tags');
    }
};
