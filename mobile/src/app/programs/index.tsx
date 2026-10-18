import { router } from 'expo-router';
import { View } from 'react-native';
import { Sheet } from '@/components/sheet';
import { Button, Chip, ListGroup, ListRow } from '@/components/ui';
import { fmtShort, sportDay } from '@/engine/dates';
import { programEnd } from '@/engine/generator';
import { nameOf, allPrograms, STATUS_LABEL, statusOf } from '@/engine/programs';
import type { ProgramStatus } from '@/engine/types';
import { useApp } from '@/store/store';
import { space } from '@/theme/tokens';

const GROUPS: [ProgramStatus, string][] = [['active', 'En cours'], ['planned', 'À venir'], ['draft', 'Brouillons'], ['done', 'Terminés'], ['archived', 'Archivés']];

/** Tous les programmes : en cours, à venir, brouillons et historique. Rien n'est effacé à la fin d'un cycle. */
export default function Programs() {
  const s = useApp(); const today = sportDay();
  const all = allPrograms(s).map(p => ({ p, st: statusOf(p, today) }));
  return (
    <Sheet title="Mes programmes" sub={`${all.length} programme${all.length > 1 ? 's' : ''}`}
      footer={<Button kind="primary" block label="Préparer mon prochain programme" onPress={() => router.push('/programs/new')} />}>
      {GROUPS.map(([st, title]) => {
        const xs = all.filter(x => x.st === st).sort((a, b) => b.p.start.localeCompare(a.p.start)); if (!xs.length) return null;
        return <ListGroup key={st} title={title}>{xs.map(({ p }, i) => (
          <ListRow key={p.id} last={i === xs.length - 1} title={nameOf(p)}
            sub={`${p.weeks} semaines, du ${fmtShort(p.start)} au ${fmtShort(programEnd(p))}${p.summary ? `. ${p.summary.done} séances sur ${p.summary.planned}` : ''}`}
            right={<Chip tone={st === 'active' ? 'accent' : st === 'planned' ? 'ok' : 'neutral'} label={STATUS_LABEL[st]} />}
            onPress={() => router.push({ pathname: '/programs/[id]', params: { id: p.id } })} />))}</ListGroup>;
      })}
      <View style={{ height: space.s4 }} />
    </Sheet>
  );
}
