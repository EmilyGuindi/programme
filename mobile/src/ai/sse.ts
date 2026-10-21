/** Lecture d'un flux SSE (event:/data:) découpé en morceaux arbitraires. */
export function sseParser(onEvent: (event: string, data: any) => void) {
  let buf = '';
  return (chunk: string) => {
    buf += chunk.replace(/\r/g, '');
    let i: number;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i); buf = buf.slice(i + 2);
      let ev = 'message'; const data: string[] = [];
      for (const line of block.split('\n')) { if (line.startsWith('event:')) ev = line.slice(6).trim(); else if (line.startsWith('data:')) data.push(line.slice(5).trimStart()); }
      if (!data.length) continue;
      try { onEvent(ev, JSON.parse(data.join('\n'))); } catch { /* bloc illisible ignoré */ }
    }
  };
}
