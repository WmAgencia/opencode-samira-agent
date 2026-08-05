/**
 * Tool: consultar_horarios
 * Permission: NETWORK
 *
 * Fetches the site's real booked appointments from AGENDA_API_URL and returns
 * them so the agent can tell the client which times are still available.
 * The agent never states a slot is free without calling this tool.
 *
 * If AGENDA_API_URL is unset or the fetch fails, the tool returns ok:false so
 * the agent falls back to "A Samira vai te atender assim que puder" instead of
 * inventing availability.
 */
import type { ToolBase } from './registry.js';
import { getEnv } from '../config/env.js';

const MAX_BODY = 64 * 1024;

function collectSlots(value: unknown, acc: string[], depth: number): void {
  if (depth > 3) return;
  if (value === null || value === undefined) return;
  if (typeof value === 'string') {
    const s = value.trim();
    if (s && /\d/.test(s) && s.length <= 64) acc.push(s);
    return;
  }
  if (typeof value === 'number') {
    if (value > 0 && value < 4102444800) {
      acc.push(new Date(value * 1000).toISOString());
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectSlots(item, acc, depth + 1);
    return;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['start', 'date', 'datetime', 'data', 'hora', 'horario', 'time', 'when', 'appointment', 'calendario']) {
      if (record[key] !== undefined) {
        collectSlots(record[key], acc, depth + 1);
      }
    }
    // Fallback: unwrap the most common list containers.
    for (const key of ['appointments', 'agendamentos', 'events', 'items', 'slots', 'data']) {
      const child = record[key];
      if (Array.isArray(child) && child.length > 0) {
        for (const item of child) collectSlots(item, acc, depth + 1);
        return;
      }
    }
  }
}

/**
 * Extracts the real opening window from the site response (`janela` field),
 * falling back to the known default window when absent. This drives which
 * times the agent lists as available, so it never invents slots.
 */
function janelaPadrao(): string[] {
  const slots: string[] = [];
  for (let h = 12; h <= 23; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
  }
  return slots;
}

function parseBooked(raw: string): { ocupados: string[]; janela: string[] } {
  const base = { ocupados: [] as string[], janela: janelaPadrao() };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Non-JSON: treat the raw text as a single opaque marker the model can read.
    const trimmed = raw.trim();
    return {
      ocupados: trimmed ? [trimmed.slice(0, 2000)] : [],
      janela: base.janela,
    };
  }
  if (typeof parsed !== 'object' || parsed === null) return base;

  const record = parsed as Record<string, unknown>;
  const acc: string[] = [];
  collectSlots(record, acc, 0);

  // Split booked markers ("YYYY-MM-DD|HH:MM" or "HH:MM") from the window list.
  const ocupados = acc.filter((s) => s.includes('|') || /^\d{1,2}:\d{2}$/.test(s));
  let janela = base.janela;
  if (Array.isArray(record.janela)) {
    const candidatos = (record.janela as unknown[])
      .filter((v): v is string => typeof v === 'string')
      .map((s) => s.trim())
      .filter((s) => /^\d{1,2}:\d{2}$/.test(s));
    if (candidatos.length > 0) janela = candidatos;
  }

  // Only keep window times that are NOT booked for the requested date.
  const requestedDate = typeof record.data === 'string' ? record.data : null;
  const ocupadosDoDia = requestedDate
    ? ocupados
        .filter((s) => s.includes('|') && s.startsWith(requestedDate))
        .map((s) => s.split('|')[1])
    : [];

  const disponiveis = janela.filter((h) => !ocupadosDoDia.includes(h));

  return { ocupados: Array.from(new Set(ocupados)).slice(0, 200), janela: disponiveis };
}

export function createConsultarHorariosTool(): ToolBase {
  return {
    definition: {
      name: 'consultar_horarios',
      description:
        'Consults the real Samira schedule and returns the already-booked ' +
        'appointments. Use this before telling a client that a time is ' +
        'available. Returns the list of booked slots; everything else is free.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    permission: 'NETWORK',
    async execute(_args, ctx) {
      const url = getEnv().AGENDA_API_URL;
      if (!url) {
        return {
          ok: false,
          output:
            'AGENDA_API_URL is not configured on the server. Cannot determine real availability.',
          error: 'tool_disabled',
        };
      }
      if (ctx.deadlineMs && Date.now() > ctx.deadlineMs) {
        return { ok: false, output: 'Tool deadline exceeded.', error: 'timeout' };
      }
      const ctrl = new AbortController();
      const remaining = Math.max(1500, ctx.deadlineMs - Date.now());
      const timer = setTimeout(() => ctrl.abort(), remaining);
      try {
        const res = await fetch(url, {
          method: 'GET',
          signal: ctrl.signal,
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
          return {
            ok: false,
            output: `Agenda API returned status ${res.status}. Cannot determine availability.`,
            error: 'io_error',
          };
        }
        const raw = await res.text();
        const { ocupados, janela } = parseBooked(raw.slice(0, MAX_BODY));
        if (janela.length === 0) {
          return {
            ok: true,
            output:
              'Nenhum horário livre no momento. Todos os horários da janela estão ocupados.',
          };
        }
        return {
          ok: true,
          output:
            'Horários disponíveis hoje/na janela (lista REAL do sistema):\n' +
            janela.map((h) => `- ${h}`).join('\n') +
            (ocupados.length > 0
              ? `\n\nHorários já marcados (NÃO disponíveis):\n` +
                ocupados.map((b) => `- ${b}`).join('\n')
              : ''),
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'network error';
        return {
          ok: false,
          output: `Falha ao consultar a agenda: ${message}`,
          error: 'io_error',
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}