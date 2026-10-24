<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('facebook_page_id')->constrained()->cascadeOnDelete();
            $table->foreignId('messenger_contact_id')->constrained()->cascadeOnDelete();
            $table->string('status', 20)->default('open')->index();  // open|handoff|closed
            $table->timestamp('last_message_at')->nullable()->index();
            $table->unsignedInteger('message_count')->default(0);
            $table->timestamps();

            $table->unique(['facebook_page_id', 'messenger_contact_id']);
        });

        Schema::create('message_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('facebook_page_id')->constrained()->cascadeOnDelete();
            $table->foreignId('messenger_contact_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('conversation_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('broadcast_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('automation_execution_id')->nullable()->constrained()->nullOnDelete();

            $table->string('direction', 10)->index();          // inbound|outbound
            $table->string('meta_message_id', 128)->nullable()->index();
            $table->string('recipient_psid', 128)->nullable()->index();
            $table->text('message_text')->nullable();
            $table->json('message_payload')->nullable();
            $table->string('message_type', 20)->default('text'); // text|button|generic|tag

            $table->string('status', 20)->default('sent')->index(); // sent|delivered|read|failed
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->text('error_message')->nullable();
            $table->string('error_code', 20)->nullable();
            $table->boolean('is_simulated')->default(false);
            $table->timestamp('occurred_at')->index();         // event time (webhook time or send time)
            $table->timestamps();

            $table->index(['user_id', 'direction', 'occurred_at']);
            $table->index(['broadcast_id', 'status']);
        });

        Schema::create('message_templates', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 150);
            $table->text('body')->nullable();
            $table->json('buttons')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'name']);
        });

        Schema::create('broadcasts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('facebook_page_id')->constrained()->cascadeOnDelete();
            $table->string('name', 150);
            $table->text('message_text')->nullable();
            $table->json('buttons')->nullable();
            $table->string('message_tag', 40)->nullable();     // allowed tags only, when out of window
            $table->string('status', 20)->default('draft')->index(); // draft|scheduled|queued|sending|paused|completed|cancelled|failed

            // Audience targeting
            $table->json('tag_filter')->nullable();            // contact tag ids to include
            $table->text('audience_description')->nullable();
            $table->unsignedBigInteger('estimated_recipients')->default(0);
            $table->unsignedBigInteger('eligible_recipients')->default(0);
            $table->unsignedBigInteger('skipped_recipients')->default(0);

            $table->timestamp('scheduled_at')->nullable()->index();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();

            // Statistics
            $table->unsignedBigInteger('sent_count')->default(0);
            $table->unsignedBigInteger('delivered_count')->default(0);
            $table->unsignedBigInteger('read_count')->default(0);
            $table->unsignedBigInteger('clicked_count')->default(0);
            $table->unsignedBigInteger('failed_count')->default(0);

            $table->timestamps();

            $table->index(['user_id', 'status', 'created_at']);
        });

        Schema::create('broadcast_recipients', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('broadcast_id')->constrained()->cascadeOnDelete();
            $table->foreignId('messenger_contact_id')->nullable()->constrained()->nullOnDelete();
            $table->string('recipient_psid', 128)->index();
            $table->string('status', 20)->default('pending')->index(); // pending|queued|sent|delivered|read|clicked|skipped|failed
            $table->string('skip_reason', 255)->nullable();
            $table->string('meta_message_id', 128)->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamp('clicked_at')->nullable();
            $table->boolean('is_simulated')->default(false);
            $table->timestamps();

            $table->unique(['broadcast_id', 'recipient_psid']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('broadcast_recipients');
        Schema::dropIfExists('broadcasts');
        Schema::dropIfExists('message_templates');
        Schema::dropIfExists('message_events');
        Schema::dropIfExists('conversations');
    }
};
