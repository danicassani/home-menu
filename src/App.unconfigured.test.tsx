import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
vi.mock('./supabase', () => ({ supabase: null }));
import App from './App';
it('explica la falta de configuración y no permite un acceso ficticio', () => {
  render(<App />);
  expect(screen.getByRole('button', { name: /Continuar con Google/ })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Falta conectar este entorno con Supabase');
});
