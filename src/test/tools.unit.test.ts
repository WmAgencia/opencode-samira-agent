/**
 * Unit tests for the scheduling/admin tools (no model calls).
 */
process.env.AGENT_API_KEY = 'chat-test-key-123';
process.env.AGENT_ENABLE_TOOLS = 'true';
process.env.AGENT_ALLOWED_PERMS = 'READ,NETWORK,WHATSAPP';

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetEnvCache } from '../config/env.js';

before(async () => {
  const { buildApp } = await import('../app.js');
  const { app } = buildApp();
  await app.ready();
  // Build the registry through the app so tools are registered.
  const { getDefaultRegistry } = await import('../tools/registry.js');
  const reg = getDefaultRegistry();
  console.log('registered:', reg.list().map((t) => t.definition.name).join(', '));
  await app.close();
});

test('consultar_horarios is registered', async () => {
  const { getDefaultRegistry } = await import('../tools/registry.js');
  const reg = getDefaultRegistry();
  assert.ok(reg.get('consultar_horarios'), 'consultar_horarios should be registered');
});

test('criar_agendamento is registered', async () => {
  const { getDefaultRegistry } = await import('../tools/registry.js');
  const reg = getDefaultRegistry();
  assert.ok(reg.get('criar_agendamento'), 'criar_agendamento should be registered');
});

test('criar_agendamento returns tool_disabled when AGENT_BOOKING_API_URL is unset', async () => {
  resetEnvCache();
  process.env.AGENT_BOOKING_API_URL = '';
  const { createCriarAgendamentoTool } = await import('../tools/criar.agendamento.js');
  const tool = createCriarAgendamentoTool();
  const res = await tool.execute(
    { nome: 'Ana', data: '2026-08-06', horario: '15:00' },
    { conversationId: 't', source: 'internal', deadlineMs: Date.now() + 5000 },
  );
  assert.equal(res.ok, false);
  assert.equal(res.error, 'tool_disabled');
});

test('criar_agendamento rejects missing required fields', async () => {
  resetEnvCache();
  process.env.AGENT_BOOKING_API_URL = 'https://example.com/api/public/booking';
  const { createCriarAgendamentoTool } = await import('../tools/criar.agendamento.js');
  const tool = createCriarAgendamentoTool();
  const res = await tool.execute(
    { nome: '', data: '2026-08-06' },
    { conversationId: 't', source: 'internal', deadlineMs: Date.now() + 5000 },
  );
  assert.equal(res.ok, false);
  assert.equal(res.error, 'invalid_args');
});

test('consultar_horarios returns tool_disabled when AGENDA_API_URL is unset', async () => {
  resetEnvCache();
  process.env.AGENDA_API_URL = '';
  const { createConsultarHorariosTool } = await import('../tools/consultar.horarios.js');
  const tool = createConsultarHorariosTool();
  const res = await tool.execute({}, {
    conversationId: 't',
    source: 'internal',
    deadlineMs: Date.now() + 5000,
  });
  assert.equal(res.ok, false);
  assert.equal(res.error, 'tool_disabled');
});

test('notify_admin_group requires a message', async () => {
  const { createNotifyAdminGroupTool } = await import('../tools/notify.admin.js');
  const tool = createNotifyAdminGroupTool();
  const res = await tool.execute({}, {
    conversationId: 't',
    source: 'internal',
    deadlineMs: Date.now() + 5000,
  });
  assert.equal(res.ok, false);
  assert.equal(res.error, 'invalid_args');
});

test('notify_admin_group returns tool_disabled when JID is unset', async () => {
  resetEnvCache();
  process.env.AGENT_ADMIN_GROUP_JID = '';
  const { createNotifyAdminGroupTool } = await import('../tools/notify.admin.js');
  const tool = createNotifyAdminGroupTool();
  const res = await tool.execute({ message: 'alguem esperando' }, {
    conversationId: 't',
    source: 'internal',
    deadlineMs: Date.now() + 5000,
  });
  assert.equal(res.ok, false);
  assert.equal(res.error, 'tool_disabled');
});

after(async () => {
  // no-op; app already closed
});