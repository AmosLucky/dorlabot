<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('business_name')->nullable()->after('name');
            $table->string('phone')->nullable()->after('email');
            $table->string('timezone', 64)->default('UTC')->after('password');
            $table->string('status', 20)->default('active')->index()->after('timezone'); // active|suspended
            $table->timestamp('last_login_at')->nullable()->after('status');
            $table->unsignedInteger('max_pages')->nullable()->after('last_login_at');
            $table->unsignedInteger('max_contacts')->nullable()->after('max_pages');
            $table->unsignedInteger('max_broadcasts_per_month')->nullable()->after('max_contacts');
            $table->text('admin_notes')->nullable()->after('max_broadcasts_per_month');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn([
                'business_name', 'phone', 'timezone', 'status', 'last_login_at',
                'max_pages', 'max_contacts', 'max_broadcasts_per_month', 'admin_notes',
            ]);
        });
    }
};
