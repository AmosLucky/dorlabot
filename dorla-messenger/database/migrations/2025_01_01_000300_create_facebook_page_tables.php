<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('facebook_pages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete(); // tenant owner
            $table->string('meta_page_id', 64)->index();
            $table->string('name', 255);
            $table->string('profile_image_url', 500)->nullable();
            $table->text('access_token_encrypted')->nullable(); // Laravel encrypted cast
            $table->string('token_type', 40)->nullable();      // page token / user token
            $table->json('granted_permissions')->nullable();
            $table->string('status', 30)->default('connected')->index(); // connected|needs_reconnect|disabled
            $table->text('status_message')->nullable();
            $table->boolean('webhook_subscribed')->default(false);
            $table->timestamp('webhook_subscribed_at')->nullable();
            $table->timestamp('last_checked_at')->nullable();
            $table->timestamp('connected_at')->nullable();
            $table->timestamps();

            // One connection per Meta Page per tenant.
            $table->unique(['user_id', 'meta_page_id']);
        });

        Schema::create('facebook_page_permissions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('facebook_page_id')->constrained()->cascadeOnDelete();
            $table->string('permission', 100)->index();
            $table->string('status', 20)->default('granted'); // granted|missing|revoked
            $table->timestamp('checked_at')->nullable();
            $table->timestamps();

            $table->unique(['facebook_page_id', 'permission']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('facebook_page_permissions');
        Schema::dropIfExists('facebook_pages');
    }
};
