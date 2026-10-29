import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInvite, inviteToText, durationFromText } from '../public/invite.js';
import { fallbackSpec } from '../public/spec.js';

const ICS = [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
  'SUMMARY:Q4 Budget Alignment\\, round 2',
  'DTSTART;TZID=Europe/Rome:20261030T100000', 'DTEND;TZID=Europe/Rome:20261030T113000',
  'DESCRIPTION:Agenda\\n- forecast\\n- headcount Join: https://teams.microsoft.com/l/xyz',
  'ORGANIZER;CN="Marco Rossi":mailto:marco.rossi@corp.it',
  'ATTENDEE;ROLE=REQ-PARTICIPANT;CN=Giulia Bianchi;RSVP=TRUE:mailto:giulia@corp.it',
  'ATTENDEE;CN="Paolo Verdi":mailto:p', ' aolo@corp.it', // folded line
  'ATTENDEE;CN=anna@corp.it:mailto:anna@corp.it', // CN that is just an email: dropped
  'END:VEVENT', 'END:VCALENDAR',
].join('\r\n');

test('.ics: title, duration from DTSTART/DTEND, names from CN, no emails anywhere', () => {
  const inv = parseInvite(ICS);
  assert.equal(inv.title, 'Q4 Budget Alignment, round 2');
  assert.equal(inv.durationMin, 90);
  assert.deepEqual(inv.names, ['Marco Rossi', 'Giulia Bianchi', 'Paolo Verdi']);
  assert.ok(inv.isInvite);
  const text = inviteToText(inv, ICS);
  assert.ok(!text.includes('@') && !text.includes('http'));
  assert.ok(text.includes('Attendees: Marco Rossi, Giulia Bianchi, Paolo Verdi'));
  assert.ok(text.includes('forecast'));
});

test('.ics DURATION property is honoured when there is no DTEND', () => {
  const inv = parseInvite('BEGIN:VEVENT\nSUMMARY:Standup\nDTSTART:20261030T090000Z\nDURATION:PT15M\nEND:VEVENT');
  assert.equal(inv.durationMin, 15);
});

test('Outlook paste (EN): Required/Optional lines, time range with AM/PM', () => {
  const inv = parseInvite(`Subject: Weekly sync
When: Thursday, October 30, 2026 11:00 AM-1:00 PM
Required: Marco Rossi; Giulia Bianchi <giulia@corp.it>
Optional: Paolo Verdi (Guest)
Microsoft Teams meeting`);
  assert.equal(inv.title, 'Weekly sync');
  assert.equal(inv.durationMin, 120);
  assert.deepEqual(inv.names, ['Marco Rossi', 'Giulia Bianchi', 'Paolo Verdi']);
});

test('Outlook paste (IT): Oggetto/Obbligatorio/Facoltativo, 24h range', () => {
  const inv = parseInvite(`Oggetto: Allineamento budget
Quando: giovedì 30 ottobre 2026 10.00-10.45
Obbligatorio: Rossi, Marco; Bianchi, Giulia
Facoltativo: Verdi Paolo`);
  assert.equal(inv.title, 'Allineamento budget');
  assert.equal(inv.durationMin, 45);
  assert.ok(inv.names.includes('Verdi Paolo') && inv.names.length === 5); // "Rossi, Marco" splits on the comma: known limit
});

test('durationFromText: minutes, hours, 24h and overnight ranges', () => {
  assert.equal(durationFromText('90 minutes'), 90);
  assert.equal(durationFromText('1h30'), 90);
  assert.equal(durationFromText('2 hours'), 120);
  assert.equal(durationFromText('23:30-00:15'), 45);
  assert.equal(durationFromText('10:00-11:30 AM'), 90);
  assert.equal(durationFromText('no times here'), 0);
});

test('plain prose passes through unchanged', () => {
  const raw = 'Budget review, Marco talks too much';
  const inv = parseInvite(raw);
  assert.equal(inv.isInvite, false);
  assert.equal(inviteToText(inv, raw), raw);
});

test('fallbackSpec uses invite names (first names), meeting length sets difficulty and round length', () => {
  const s = fallbackSpec(ICS, () => 0);
  assert.deepEqual(s.actors.map((a) => a.label), ['Marco', 'Giulia', 'Paolo']);
  assert.equal(s.title, 'Q4 Budget Alignment, round 2');
  assert.equal(s.difficulty, 'hard');
  assert.equal(s.durationSec, 90);
  const short = fallbackSpec('Subject: Standup\n15 minutes\nAttendees: Anna, Luca', () => 0);
  assert.equal(short.difficulty, 'easy');
  assert.equal(short.durationSec, 30); // clamped up from 15
  assert.deepEqual(short.actors.map((a) => a.label), ['Anna', 'Luca']);
});
