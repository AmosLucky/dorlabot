<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // automation types: welcome | default_reply | keyword | comment_reply
        Schema::create('automation_rules', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('facebook_page_id')->constrained()->cascadeOnDelete();
            $table->string('type', 30)->index();          // see above
            $table->string('name', 150);
            $table->boolean('is_enabled')->default(false)->index();

            // Keyword matching (keyword + comment types)
            $table->string('match_type', 20)->default('contains')->nullable(); // contains|exact|starts_with|any
            $table->json('keywords')->nullable();

            // Comment automation target
            $table->string('meta_post_id', 128)->nullable()->index();
            $table->string('post_url', 500)->nullable();

            // Message content (JSON with buttons/quick replies payload structure)
            $table->text('message_text')->nullable();
            $table->json('buttons')->nullable();
            $table->json('quick_replies')->nullable();
            $table->text('fallback_text')->nullable();

            // Comment private reply follow-up message (sent after first contact action)
            $table->text('follow_up_text')->nullable();

            // Business-hours behavior for default replies
            $table->boolean('business_hours_enabled')->default(false);
            $table->time('business_hours_start')->nullable();
            $table->time('business_hours_end')->nullable();
            $table->string('business_hours_timezone', 64)->nullable();
            $table->text('after_hours_text')->nullable();

            // Human handoff
            $table->boolean('handoff_enabled')->default(false);
            $table->text('handoff_text')->nullable();

            // Priority among matching rules (lower wins; engine dedupes).
            $table->unsignedInteger('priority')->default(100)->index();

            // Statistics
            $table->unsignedBigInteger('executions_count')->default(0);
            $table->unsignedBigInteger('replies_sent_count')->default(0);

            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['facebook_page_id', 'type', 'is_enabled']);
        });

        Schema::create('automation_steps', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('automation_rule_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('sequence')->default(1);
            $table->string('step_type', 30)->default('message'); // message|delay|handoff
            $table->text('message_text')->nullable();
            $table->json('payload')->nullable();
            $table->unsignedInteger('delay_seconds')->default(0);
            $table->timestamps();

            $table->index(['automation_rule_id', 'sequence']);
        });

        Schema::create('automation_executions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('automation_rule_id')->constrained()->cascadeOnDelete();
            $table->foreignId('facebook_page_id')->constrained()->cascadeOnDelete();
            $table->foreignId('messenger_contact_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('comment_event_id')->nullable()->constrained()->nullOnDelete();
            $table->string('trigger', 40)->index();       // message|postback|comment|simulated
            $table->string('matched_rule_detail', 255)->nullable();
            $table->string('status', 20)->default('pending')->index(); // pending|sent|skipped|failed|duplicate
            $table->string('skip_reason', 255)->nullable();
            $table->json('rendered_message')->nullable();
            $table->string('meta_message_id', 128)->nullable();
            $table->text('error_message')->nullable();
            $table->boolean('is_simulated')->default(false);
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index(['automation_rule_id', 'created_at']);
        });

        Schema::create('comment_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('facebook_page_id')->constrained()->cascadeOnDelete();
            $table->foreignId('automation_rule_id')->nullable()->constrained()->nullOnDelete();
            $table->string('meta_comment_id', 128)->unique();
            $table->string('meta_post_id', 128)->nullable()->index();
            $table->string('commenter_psid_like_id', 128)->nullable(); // meta sender id
            $table->string('commenter_name', 200)->nullable();
            $table->text('message')->nullable();
            $table->string('parent_id', 128)->nullable();
            $table->string('status', 20)->default('pending')->index(); // pending|processed|skipped|failed|duplicate
            $table->string('skip_reason', 255)->nullable();
            $table->timestamp('private_replied_at')->nullable();
            $table->unsignedSmallInteger('private_reply_count')->default(0); // enforce one-per-comment
            $table->text('error_message')->nullable();
            $table->boolean('is_simulated')->default(false);
            $table->timestamps();

            $table->index(['facebook_page_id', 'status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comment_events');
        Schema::dropIfExists('automation_executions');
        Schema::dropIfExists('automation_steps');
        Schema::dropIfExists('automation_rules');
    }
};
