import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.tsx';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { useToast } from '@/components/ui/use-toast';
import { logger } from '@/lib/logger';

const signUpSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required').max(60, 'First name is too long'),
    lastName: z.string().trim().max(60, 'Last name is too long'),
    email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type SignUpFormData = z.infer<typeof signUpSchema>;

export default function SignUpPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit = async (data: SignUpFormData) => {
    try {
      setIsLoading(true);
      await signUp(data.email, data.password, data.firstName, data.lastName);
      toast({
        title: 'Account created',
        description: 'Your account is ready.',
      });
      navigate('/dashboard', { replace: true });
    } catch (error: any) {
      logger.error('Sign up failed', error);
      toast({
        title: 'Sign up failed',
        description: error.message || 'Failed to create account. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-6 w-full max-w-md mx-auto">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your legal account name, email, and a secure password.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label htmlFor="firstName" className="text-sm font-medium leading-none">First name</label>
            <Input id="firstName" data-testid="signup-first-name" autoComplete="given-name" {...register('firstName')} error={errors.firstName?.message} />
          </div>
          <div className="space-y-2">
            <label htmlFor="lastName" className="text-sm font-medium leading-none">Last name</label>
            <Input id="lastName" data-testid="signup-last-name" autoComplete="family-name" {...register('lastName')} error={errors.lastName?.message} />
          </div>
        </div>
        <div className="space-y-2">
          <label
            htmlFor="email"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Email
          </label>
          <Input
            id="email"
            data-testid="auth-email"
            type="email"
            placeholder="name@example.com"
            autoComplete="email"
            {...register('email')}
            error={errors.email?.message}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="password"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Password
          </label>
          <PasswordInput
            id="password"
            data-testid="auth-password"
            placeholder="••••••••"
            autoComplete="new-password"
            visibilityLabel="password"
            {...register('password')}
            error={errors.password?.message}
          />
          <p className="text-xs text-muted-foreground">
            Must be at least 8 characters with uppercase, lowercase, and a number
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="confirmPassword"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Confirm Password
          </label>
          <PasswordInput
            id="confirmPassword"
            data-testid="signup-confirm-password"
            placeholder="••••••••"
            autoComplete="new-password"
            visibilityLabel="password confirmation"
            {...register('confirmPassword')}
            error={errors.confirmPassword?.message}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading} data-testid="signup-submit">
          {isLoading ? 'Creating account...' : 'Create account'}
        </Button>
      </form>

      <p className="px-8 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          to="/login"
          className="underline underline-offset-4 hover:text-primary"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
