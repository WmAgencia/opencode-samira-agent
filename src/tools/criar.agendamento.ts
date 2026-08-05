/**
 * Tool: criar_agendamento
 * Permission: NETWORK
 *
 * Creates a real booking on the Samira site through the public booking
 * endpoint (POST /api/public/booking). This is the ONLY way the agent
 * confirms an appointment: the booking is persisted on the site, which
 * then fires the internal group notification (notificarGrupo) when
 * notify_new_bookings is enabled.
 *
 * If AGENT_BOOKING_API_URL is unset or the request fails, the tool
 * returns ok:false so the agent NEVER tells the client the slot was
 * reserved without real confirmation.
 */
import type { ToolBase } from './registry.js';
import { getEnv } from '../config/env.js';

const MAX_BODY = 64 * 1024;

export function createCriarAgendamentoTool(): ToolBase {
  return {
    definition: {
      name: 'criar_agendamento',
      description:
        'Reserva o agendamento da sessão no sistema real do site, depois que a ' +
        'pessoa escolheu data e horário e informou nome. Use SEMPRE antes de ' +
        'confirmar para o cliente que o horário foi reservado. Retorna o id do ' +
        'agendamento criado ou um erro claro. Nunca confirme uma reserva sem ' +
        'chamar esta ferramenta e receber ok:true.',
      parameters: {
        type: 'object',
        properties: {
          nome: {
            type: 'string',
            description: 'Nome completo informado pela pessoa.',
          },
          telefone: {
            type: 'string',
            description: 'Telefone/WhatsApp da pessoa (com DDD).',
          },
          email: {
            type: 'string',
            description: 'E-mail da pessoa, quando informado (opcional).',
          },
          data: {
            type: 'string',
            description: 'Data do agendamento no formato AAAA-MM-DD.',
          },
          horario: {
            type: 'string',
            description: 'Horário no formato HH:MM (12:00 a 23:00).',
          },
          servico: {
            type: 'string',
            description: 'Nome do atendimento/sessão (opcional).',
          },
        },
        required: ['nome', 'data', 'horario'],
      },
    },
    permission: 'NETWORK',
    async execute(args, ctx) {
      const url = getEnv().AGENT_BOOKING_API_URL;
      if (!url) {
        return {
          ok: false,
          output:
            'AGENT_BOOKING_API_URL is not configured on the server. Cannot create the booking.',
          error: 'tool_disabled',
        };
      }
      if (ctx.deadlineMs && Date.now() > ctx.deadlineMs) {
        return { ok: false, output: 'Tool deadline exceeded.', error: 'timeout' };
      }

      const nome = typeof args.nome === 'string' ? args.nome.trim() : '';
      const data = typeof args.data === 'string' ? args.data.trim() : '';
      const horario = typeof args.horario === 'string' ? args.horario.trim() : '';
      const telefone =
        typeof args.telefone === 'string' ? args.telefone.trim() : '';
      const email = typeof args.email === 'string' ? args.email.trim() : '';
      const servico =
        typeof args.servico === 'string' ? args.servico.trim() : '';

      if (!nome || !data || !horario) {
        return {
          ok: false,
          output: 'nome, data e horario são obrigatórios para criar o agendamento.',
          error: 'invalid_args',
        };
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        return { ok: false, output: 'Data inválida. Use o formato AAAA-MM-DD.', error: 'invalid_args' };
      }

      const ctrl = new AbortController();
      const remaining = Math.max(2000, ctx.deadlineMs - Date.now());
      const timer = setTimeout(() => ctrl.abort(), remaining);
      try {
        const res = await fetch(url, {
          method: 'POST',
          signal: ctrl.signal,
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            client_name: nome,
            phone: telefone,
            email: email || undefined,
            service_name: servico || 'Sessão de atendimento',
            modality: 'online',
            scheduled_date: data,
            scheduled_time: horario,
            channel: 'whatsapp',
          }),
        });
        const raw = await res.text();
        if (!res.ok) {
          return {
            ok: false,
            output: `O sistema de agendamento retornou status ${res.status}. Não confirme a reserva.`,
            error: 'io_error',
          };
        }
        let parsed: { ok?: boolean; id?: string; error?: string } = {};
        try {
          parsed = JSON.parse(raw.slice(0, MAX_BODY)) as typeof parsed;
        } catch {
          // non-JSON; treat success based on status only
        }
        if (parsed?.ok === false || !parsed) {
          return {
            ok: false,
            output: `Não foi possível criar o agendamento: ${parsed?.error ?? 'resposta inválida'}`,
            error: 'io_error',
          };
        }
        return {
          ok: true,
          output: `Agendamento criado com sucesso (id=${parsed.id ?? 'confirmado'}).`,
          data: { id: parsed.id },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'network error';
        return {
          ok: false,
          output: `Falha ao criar o agendamento: ${message}`,
          error: 'io_error',
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
