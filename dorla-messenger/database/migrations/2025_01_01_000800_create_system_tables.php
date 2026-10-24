<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Idempotency ledger: every Meta webhook event id is stored once.
        Schema::create('webhook_events', function (Blueprint $table): void {
            $table->id();
            $table->string('event_key', 191)->unique();      // sha256 of entry+event identifiers
            $table->string('object', 40)->nullable();        // page
            $table->string('field', 60)->nullable();         // messages|feed|...
            $table->foreignId('facebook_page_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 20)->default('received')->index(); // received|processed|failed|duplicated
            $table->json('summary')->nullable();             // minimal metadata only, no PII payloads
            $table->timestamp('received_at');
            $table->timestamps();

            $table->index(['status', 'received_at']);
        });

        Schema::create('integration_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('facebook_page_id')->nullable()->constrained()->nullOnDelete();
            $table->string('channel', 40)->default('meta');   // meta|email|system
            $table->string('operation', 80)->index();         // oauth|send|webhook|subscribe|token_refresh
            $table->string('level', 20)->default('info')->index(); // info|warning|error
            $table->string('message', 500)->nullable();
            $table->json('context')->nullable();              // secrets scrubbed before write
            $table->timestamps();

            $table->index(['channel', 'level', 'created_at']);
        });

        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('target_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 100)->index();           // user.suspended|page.disabled|settings.updated...
            $table->string('subject_type', 80)->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->json('changes')->nullable();              // redacted diff
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->timestamps();

            $table->index(['action', 'created_at']);
        });

        Schema::create('account_settings', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('business_name', 150)->nullable();
            $table->string('support_email', 150)->nullable();
            $table->string('default_fallback_first_name', 50)->default('there');
            $table->json('preferences')->nullable();
            $table->timestamps();
        });

        Schema::create('system_settings', function (Blueprint $table): void {
            $table->id();
            $table->string('key', 100)->unique();
            $table->json('value')->nullable();
            $table->string('group', 50)->default('general')->index();
            $table->string('description', 255)->nullable();
            $table->timestamps();
        });

        Schema::create('data_deletion_requests', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('email', 150);
            $table->string('status', 20)->default('pending')->index(); // pending|approved|processing|completed|rejected
            $table->text('reason')->nullable();
            $table->text('admin_note')->nullable();
            $table->timestamp('requested_at');
            $table->timestamp('processed_at')->nullable();
            $table->foreignId('processed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('data_deletion_requests');
        Schema::dropIfExists('system_settings');
        Schema::dropIfExists('account_settings');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('integration_logs');
        Schema::dropIfExists('webhook_events');
    }
};
