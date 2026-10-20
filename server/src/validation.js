export const STATUSES = ['Aberto', 'Em análise', 'Em manutenção', 'Resolvido'];
export const CATEGORIES = ['Iluminação', 'Hidráulica', 'Estacionamento', 'Barulho', 'Limpeza', 'Manutenção', 'Elétrica', 'Portas/portões', 'Área externa', 'Outros'];
export const PRIORITIES = ['Baixa', 'Média', 'Alta'];
export function validEmail(email) { return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && email.length <= 254; }
export function validPassword(value) { return typeof value === 'string' && value.length >= 8 && value.length <= 72 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value); }
export function clean(value, max = 255) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
export function positiveInt(value) { const number = Number(value); return Number.isInteger(number) && number > 0 ? number : null; }
export function nextStatus(value) { const index = STATUSES.indexOf(value); return index > -1 && index < STATUSES.length - 1 ? STATUSES[index + 1] : null; }
export function ticketValidation(body) {
  const title = clean(body.title, 100), description = clean(body.description, 3000);
  const category = clean(body.category, 50), location = clean(body.location, 200);
  const block = clean(body.block, 40), priority = clean(body.priority, 20) || 'Média';
  if (title.length < 5) return { error: 'O título deve ter pelo menos 5 caracteres.' };
  if (description.length < 10) return { error: 'Descreva o problema com pelo menos 10 caracteres.' };
  if (!CATEGORIES.includes(category)) return { error: 'Selecione uma categoria válida.' };
  if (location.length < 3) return { error: 'Informe a localização do problema.' };
  if (!PRIORITIES.includes(priority)) return { error: 'Selecione uma prioridade válida.' };
  return { value: { title, description, category, location, block, priority } };
}
