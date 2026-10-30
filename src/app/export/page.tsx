import { ExportPanel } from '@/components/export/ExportPanel'
import { Credits } from '@/components/export/Credits'
import { FileHeader, PageBody } from '@/components/dossier/FileHeader'

export default function ExportPage() {
  return (
    <>
      <FileHeader label="Company records" title="File" summary="Campaign settings, and Campaign Files for backups and moving between devices." />
      <PageBody>
        <ExportPanel />
        <Credits />
      </PageBody>
    </>
  )
}
