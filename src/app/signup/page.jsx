'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { registerUser, getUser } from '@/lib/auth';
import { Input, Button } from '@/components/ui';

export default function SignUpPage() {
  const router = useRouter();

  const [fields, setFields] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Already logged in → go to dashboard
  useEffect(() => {
    if (getUser()) router.replace('/');
  }, [router]);

  function set(field) {
    return (e) => setFields((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function validate() {
    const errs = {};

    if (!fields.name.trim()) errs.name = 'Full name is required.';
    if (!fields.username.trim()) errs.username = 'Username is required.';
    if (!fields.email.trim()) {
      errs.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
      errs.email = 'Enter a valid email address.';
    }
    if (!fields.password) {
      errs.password = 'Password is required.';
    } else if (fields.password.length < 6) {
      errs.password = 'Password must be at least 6 characters.';
    }
    if (!fields.confirmPassword) {
      errs.confirmPassword = 'Please confirm your password.';
    } else if (fields.confirmPassword !== fields.password) {
      errs.confirmPassword = 'Passwords do not match.';
    }

    return errs;
  }

  function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);

    // Simulate async so the flow is easy to swap for a real API call
    setTimeout(() => {
      const result = registerUser({
        name: fields.name.trim(),
        username: fields.username.trim(),
        email: fields.email.trim(),
        password: fields.password,
      });

      if (result.ok) {
        setSuccess(true);
      } else {
        setFormError(result.error);
      }

      setLoading(false);
    }, 0);
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <p className="text-[15px] font-bold tracking-[0.15em] uppercase">PLACEBO</p>
            <p className="text-[12px] text-[#737373] tracking-wider mt-0.5">PLM System</p>
          </div>

          <div className="bg-white border border-[#e5e5e5] rounded-lg px-8 py-8 text-center">
            <p className="text-[15px] font-semibold tracking-tight mb-2">Account created</p>
            <p className="text-[13px] text-[#737373] mb-6">
              Your account has been created successfully. Please log in.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full bg-[#0a0a0a] text-white text-[13px] font-medium tracking-tight px-3.5 py-2 rounded hover:bg-[#262626] transition-colors"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="mb-8 text-center">
          <p className="text-[15px] font-bold tracking-[0.15em] uppercase">PLACEBO</p>
          <p className="text-[12px] text-[#737373] tracking-wider mt-0.5">PLM System</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#e5e5e5] rounded-lg px-8 py-8">
          <h1 className="text-[16px] font-semibold tracking-tight mb-6">Create account</h1>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              label="Full Name"
              type="text"
              value={fields.name}
              onChange={set('name')}
              autoComplete="name"
              autoFocus
              error={errors.name}
            />
            <Input
              label="Username"
              type="text"
              value={fields.username}
              onChange={set('username')}
              autoComplete="username"
              error={errors.username}
            />
            <Input
              label="Email"
              type="email"
              value={fields.email}
              onChange={set('email')}
              autoComplete="email"
              error={errors.email}
            />
            <Input
              label="Password"
              type="password"
              value={fields.password}
              onChange={set('password')}
              autoComplete="new-password"
              error={errors.password}
            />
            <Input
              label="Confirm Password"
              type="password"
              value={fields.confirmPassword}
              onChange={set('confirmPassword')}
              autoComplete="new-password"
              error={errors.confirmPassword}
            />

            {formError && (
              <p className="text-[12px] text-red-600">{formError}</p>
            )}

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              className="w-full mt-2"
            >
              Create account
            </Button>
          </form>
        </div>

        <p className="text-center text-[12px] text-[#737373] mt-5">
          Already have an account?{' '}
          <Link href="/login" className="text-[#0a0a0a] font-medium hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
