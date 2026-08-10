'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { login, getUser } from '@/lib/auth';
import { Input, Button } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Already logged in → go to dashboard
  useEffect(() => {
    if (getUser()) router.replace('/');
  }, [router]);

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Simulate async so the flow is easy to swap for a real API call
    setTimeout(() => {
      const result = login(username, password);
      if (result.ok) {
        router.replace('/');
      } else {
        setError('Incorrect username or password.');
        setLoading(false);
      }
    }, 0);
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
          <h1 className="text-[16px] font-semibold tracking-tight mb-6">Sign in</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            {error && (
              <p className="text-[12px] text-red-600">{error}</p>
            )}

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              className="w-full mt-2"
            >
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
