import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const { resetPasswordForEmail, getUser, updateUserById } = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  getUser: vi.fn(),
  updateUserById: vi.fn(),
}));

vi.mock('../../config/database.js', () => ({
  createAuthClient: () => ({ auth: { resetPasswordForEmail, getUser } }),
  getSupabaseAdmin: () => ({ auth: { admin: { updateUserById } } }),
}));

vi.mock('../../config/env.js', () => ({
  env: { PASSWORD_RESET_REDIRECT_URL: 'https://enviazo.cl/nueva-clave', NODE_ENV: 'test' },
}));

import {
  forgotPassword,
  resetPassword,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../../controllers/auth.controller.js';
import { validate } from '../../middleware/validate.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post('/forgot', validate(forgotPasswordSchema), forgotPassword);
  app.post('/reset', validate(resetPasswordSchema), resetPassword);
  return app;
}

describe('recuperacion de contrasena', () => {
  const app = buildApp();

  beforeEach(() => {
    resetPasswordForEmail.mockReset().mockResolvedValue({ error: null });
    getUser.mockReset();
    updateUserById.mockReset().mockResolvedValue({ error: null });
  });

  describe('pedir el enlace', () => {
    it('envia el correo cuando la cuenta existe', async () => {
      const res = await request(app).post('/forgot').send({ email: 'miguel@enviazo.cl' });

      expect(res.status).toBe(200);
      expect(resetPasswordForEmail).toHaveBeenCalledWith('miguel@enviazo.cl', {
        redirectTo: 'https://enviazo.cl/nueva-clave',
      });
    });

    // Si la respuesta cambiara segun exista o no la cuenta, cualquiera podria
    // averiguar que correos estan registrados probandolos uno por uno.
    it('responde igual aunque la cuenta no exista', async () => {
      const existe = await request(app).post('/forgot').send({ email: 'miguel@enviazo.cl' });

      resetPasswordForEmail.mockResolvedValue({ error: { message: 'User not found' } });
      const noExiste = await request(app).post('/forgot').send({ email: 'nadie@enviazo.cl' });

      expect(noExiste.status).toBe(existe.status);
      expect(noExiste.body).toEqual(existe.body);
    });

    it('responde igual aunque falle el proveedor de correo', async () => {
      resetPasswordForEmail.mockRejectedValue(new Error('SMTP caido'));
      const res = await request(app).post('/forgot').send({ email: 'miguel@enviazo.cl' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Si el correo está registrado');
    });

    it('rechaza un correo mal escrito', async () => {
      const res = await request(app).post('/forgot').send({ email: 'no-es-un-correo' });
      expect(res.status).toBe(400);
    });
  });

  describe('fijar la contrasena nueva', () => {
    it('la cambia con un token valido', async () => {
      getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });

      const res = await request(app)
        .post('/reset')
        .send({ access_token: 'token-valido', new_password: 'clave-nueva-123' });

      expect(res.status).toBe(200);
      expect(updateUserById).toHaveBeenCalledWith('user-1', { password: 'clave-nueva-123' });
    });

    it('rechaza un token vencido o inventado', async () => {
      getUser.mockResolvedValue({ data: null, error: { message: 'invalid token' } });

      const res = await request(app)
        .post('/reset')
        .send({ access_token: 'token-basura', new_password: 'clave-nueva-123' });

      expect(res.status).toBe(400);
      expect(res.body.reason).toBe('invalid_reset_token');
      expect(updateUserById).not.toHaveBeenCalled();
    });

    it('no acepta una contrasena de menos de 6 caracteres', async () => {
      const res = await request(app)
        .post('/reset')
        .send({ access_token: 'token-valido', new_password: '123' });

      expect(res.status).toBe(400);
      expect(updateUserById).not.toHaveBeenCalled();
    });

    it('avisa si el cambio falla en Supabase', async () => {
      getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
      updateUserById.mockResolvedValue({ error: { message: 'boom' } });

      const res = await request(app)
        .post('/reset')
        .send({ access_token: 'token-valido', new_password: 'clave-nueva-123' });

      expect(res.status).toBe(400);
    });
  });
});
