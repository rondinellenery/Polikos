import test from 'node:test';
import assert from 'node:assert/strict';
import { validEmail, validPassword, nextStatus, ticketValidation } from '../src/validation.js';
test('email com formato válido', () => { assert.equal(validEmail('teste@email.com'),true); assert.equal(validEmail('invalido'),false); });
test('senha exige maiúscula minúscula e número', () => { assert.equal(validPassword('MinhaSenha123'),true); assert.equal(validPassword('fraca'),false); });
test('fluxo de status não ultrapassa resolvido', () => { assert.equal(nextStatus('Aberto'),'Em análise'); assert.equal(nextStatus('Resolvido'),null); });
test('chamado exige categoria localização e descrição', () => {
  const input={title:'Lâmpada quebrada',description:'Lâmpada quebrada na garagem.',category:'Iluminação',location:'Garagem',priority:'Alta'};
  assert.ok(ticketValidation(input).value);assert.ok(ticketValidation({...input,location:''}).error);
});
