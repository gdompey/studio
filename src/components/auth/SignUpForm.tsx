// src/components/auth/SignUpForm.tsx
"use client";

import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, KeyRound, User as UserIcon } from 'lucide-react';

const signUpSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

type SignUpFormValues = z.infer<typeof signUpSchema>;

export function SignUpForm() {
  const { signUp, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [formLoading, setFormLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit: SubmitHandler<SignUpFormValues> = async (data) => {
    if (!signUp) {
        toast({ title: 'Sign up not available', description: 'Sign up functionality is currently disabled.', variant: 'destructive' });
        return;
    }
    setFormLoading(true);
    try {
      await signUp(data);
      toast({ title: 'Account created successfully!' });
    } catch (error) {
      toast({
        title: 'Sign up failed',
        description: (error as Error).message || 'An error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setFormLoading(false);
    }
  };
  
  const isLoading = authLoading || formLoading;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Full Name</Label>
        <div className="relative">
          <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            id="name"
            type="text"
            placeholder="John Doe"
            className="pl-10"
            {...register('name')}
            aria-invalid={errors.name ? "true" : "false"}
          />
        </div>
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            placeholder="your.email@example.com"
            className="pl-10"
            {...register('email')}
            aria-invalid={errors.email ? "true" : "false"}
          />
        </div>
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
         <div className="relative">
          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            className="pl-10"
            {...register('password')}
            aria-invalid={errors.password ? "true" : "false"}
          />
        </div>
        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
      </div>

      <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading || !signUp}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Sign Up
      </Button>
    </form>
  );
}
