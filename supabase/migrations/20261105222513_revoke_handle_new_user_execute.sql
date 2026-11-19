-- The trigger still fires on sign-up; this only removes direct RPC access.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
