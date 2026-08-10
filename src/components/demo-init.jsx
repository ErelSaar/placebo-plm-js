'use client';

import { useEffect } from 'react';
import { initializeDemoData } from '@/lib/demo-init';

export function DemoInit() {
  useEffect(() => {
    initializeDemoData();
  }, []);
  return null;
}
