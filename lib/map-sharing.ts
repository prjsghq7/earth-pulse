export interface MapFilters {
  startDate: string;
  endDate: string;
  minMagnitude: string;
  maxDepth: string;
}

export interface CopyAddressResult {
  kind: 'success' | 'error';
  message: string;
}

export function parseMapFilters(targetDate: string, query: string): MapFilters {
  const values = new URLSearchParams(query);
  const startDate = values.get('start') ?? targetDate;
  const endDate = values.get('end') ?? targetDate;
  return {
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : targetDate,
    endDate: /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate : targetDate,
    minMagnitude: values.get('min') ?? '4.0',
    maxDepth: values.get('depth') ?? '700',
  };
}

export function buildMapHash(filters: MapFilters) {
  const query = new URLSearchParams({
    start: filters.startDate,
    end: filters.endDate,
    min: filters.minMagnitude,
    depth: filters.maxDepth,
  });
  return `#/map?${query.toString()}`;
}

export async function copyPageAddress(
  address: string,
  writeText: (text: string) => Promise<void>,
): Promise<CopyAddressResult> {
  try {
    await writeText(address);
    return { kind: 'success', message: '화면 주소를 복사했어요.' };
  } catch {
    return { kind: 'error', message: '주소 복사에 실패했습니다.' };
  }
}
