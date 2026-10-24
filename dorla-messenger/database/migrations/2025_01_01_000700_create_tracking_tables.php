<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tracked_links', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('facebook_page_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('broadcast_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('automation_rule_id')->nullable()->constrained()->nullOnDelete();
            $table->string('tracking_code', 24)->unique();
            $table->text('destination_url');                 // validated against open redirects
            $table->string('label', 150)->nullable();
            $table->unsignedBigInteger('clicks_count')->default(0);
            $table->unsignedBigInteger('unique_clicks_count')->default(0);
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index(['broadcast_id']);
        });

        Schema::create('link_click_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tracked_link_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('messenger_contact_id')->nullable()->constrained()->nullOnDelete();
            $table->string('recipient_psid', 128)->nullable()->index();
            $table->string('ip_hash', 64)->nullable();       // salted hash for dedup, not raw IP
            $table->string('user_agent', 255)->nullable();
            $table->string('referer', 500)->nullable();
            $table->timestamp('clicked_at')->index();
            $table->timestamps();

            $table->index(['tracked_link_id', 'clicked_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('link_click_events');
        Schema::dropIfExists('tracked_links');
    }
};
