import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ getSession: vi.fn(), onAuthStateChange: vi.fn(), signInWithOAuth: vi.fn(), signOut: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { auth } }));
vi.mock('./Household', () => ({ default: () => null }));
import App from './App';
beforeEach(() => {
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  auth.signInWithOAuth.mockResolvedValue({ error: null });
});
describe('acceso', () => {
  it('inicia Google con retorno al origen de la aplicación', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Continuar con Google/ }));
    await waitFor(() => expect(auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: `${window.location.origin}/` } }));
  });
  it('informa de un fallo OAuth y permite reintentar', async () => {
    auth.signInWithOAuth.mockResolvedValue({ error: new Error('failure') });
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Continuar con Google/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido abrir Google');
    expect(screen.getByRole('button', { name: /Continuar con Google/ })).toBeEnabled();
  });
  it('restaura una sesión y permite cerrarla', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { user_metadata: { full_name: 'Ana' } } } }, error: null });
    auth.signOut.mockResolvedValue({ error: null });
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Hola, Ana' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('button', { name: /Continuar con Google/ })).toBeEnabled();
  });
  it('mantiene la sesión visible si falla el cierre', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { user_metadata: {} } } }, error: null });
    auth.signOut.mockResolvedValue({ error: new Error('failure') });
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido cerrar');
    expect(screen.getByRole('heading', { name: 'Hola, Tu perfil' })).toBeInTheDocument();
  });
  it('desactiva el acceso si se pierde conexión', async () => {
    render(<App />);
    await screen.findByRole('button', { name: /Continuar con Google/ });
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    fireEvent(window, new Event('offline'));
    expect(screen.getByRole('button', { name: /Continuar con Google/ })).toBeDisabled();
  });
});
