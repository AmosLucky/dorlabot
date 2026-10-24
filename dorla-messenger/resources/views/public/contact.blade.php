@extends('layouts.public')
@section('title', 'Contact')
@section('content')
<section class="hero-wrap"><div class="container py-5">
    <div class="row justify-content-center"><div class="col-lg-7 text-center">
        <h1 class="font-hero mb-3">Talk to us</h1>
        <p class="font-sub-hero">Questions about setup, Meta app review or billing? Send a note and we will reply by email.</p>
    </div></div>
</div></section>
<section class="section-pad pt-4"><div class="container">
    <div class="row justify-content-center"><div class="col-lg-7">
        <div class="card p-4 p-lg-5">
            @include('partials.errors')
            <form method="POST" action="{{ route('contact.submit') }}">
                @csrf
                <div class="row g-3">
                    <div class="col-md-6"><label class="form-label" for="name">Your name</label>
                        <input id="name" name="name" value="{{ old('name') }}" class="form-control @error('name') is-invalid @enderror" required>
                        @error('name')<div class="invalid-feedback">{{ $message }}</div>@enderror</div>
                    <div class="col-md-6"><label class="form-label" for="email">Email</label>
                        <input id="email" type="email" name="email" value="{{ old('email') }}" class="form-control @error('email') is-invalid @enderror" required>
                        @error('email')<div class="invalid-feedback">{{ $message }}</div>@enderror</div>
                    <div class="col-12"><label class="form-label" for="subject">Subject</label>
                        <input id="subject" name="subject" value="{{ old('subject') }}" class="form-control @error('subject') is-invalid @enderror" required>
                        @error('subject')<div class="invalid-feedback">{{ $message }}</div>@enderror</div>
                    <div class="col-12"><label class="form-label" for="message">Message</label>
                        <textarea id="message" name="message" rows="5" class="form-control @error('message') is-invalid @enderror" required>{{ old('message') }}</textarea>
                        @error('message')<div class="invalid-feedback">{{ $message }}</div>@enderror</div>
                    <div class="col-12"><button class="btn btn-primary w-100"><i class="bi bi-send me-2"></i>Send message</button></div>
                </div>
            </form>
        </div>
    </div></div>
</div></section>
@endsection
