import type { AssetRecord } from './schema'

export const ASSET_LICENSES_BEGIN_MARKER = '<!-- BEGIN GENERATED ASSET LICENSES -->'
export const ASSET_LICENSES_END_MARKER = '<!-- END GENERATED ASSET LICENSES -->'

function escapeMarkdown(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\\', '\\\\')
    .replaceAll('|', '\\|')
    .replaceAll(/[\r\n]+/g, ' ')
}

function encodeMarkdownLinkTarget(value: string): string {
  return value.replace(/[()|<>"'\s]/g, (character) =>
    [...new TextEncoder().encode(character)]
      .map((byte) => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`)
      .join(''),
  )
}

function compareCodePoints(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function provenance(record: AssetRecord): string {
  const links: string[] = []
  if (record.sourceUrl) links.push(`[Source](${encodeMarkdownLinkTarget(record.sourceUrl)})`)
  if (record.generationRecord) {
    links.push(`[Generation record](${encodeMarkdownLinkTarget(record.generationRecord)})`)
  }
  return links.length > 0 ? links.join('<br>') : '—'
}

export function renderAssetLicenseLedger(records: readonly AssetRecord[]): string {
  const rows = [...records]
    .sort((left, right) => compareCodePoints(left.id, right.id))
    .map(
      (record) =>
        `| \`${escapeMarkdown(record.id)}\` | ${record.kind} | ${escapeMarkdown(record.author)} | ${record.license} | ${provenance(record)} | ${escapeMarkdown(record.attribution)} |`,
    )
  return [
    ASSET_LICENSES_BEGIN_MARKER,
    '| Asset ID | Kind | Author | License | Provenance | Attribution |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows,
    ASSET_LICENSES_END_MARKER,
  ].join('\n')
}
