import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Copy, ExternalLink, MessageCircle, Printer } from 'lucide-react'
import { brlCents, dateBR } from '../lib/format'
import { formatPhone, toWhatsAppNumber, whatsappUrl } from '../lib/documents'
import { useStore } from '../data/store'
import { ProposalDocument, type ProposalData } from './ProposalDocument'
import { Badge, Button, Field, Modal, inputCls } from './ui'

export function defaultWhatsAppMessage(d: ProposalData) {
  const first = d.client?.name.split(' ')[0] ?? ''
  const total = d.result.totalCents === null ? '[valor pendente]' : brlCents(d.result.totalCents)
  return `Olá, ${first}! Tudo bem? Segue o orçamento ${d.number} referente à obra ${d.site?.name ?? ''}. O valor total é ${total}, com validade até ${d.validUntil ? dateBR(d.validUntil) : '[data]'}. Qualquer dúvida, fico à disposição.`
}

export function WhatsAppDialog({ open, onClose, data }: { open: boolean; onClose: () => void; data: ProposalData }) {
  const { toast } = useStore()
  const [phone, setPhone] = useState('')
  const [msg, setMsg] = useState('')
  useEffect(() => {
    if (open) {
      setPhone(data.client?.whatsapp || data.client?.phone || '')
      setMsg(defaultWhatsAppMessage(data))
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const url = whatsappUrl(phone, msg)
  const phoneErr = phone && !toWhatsAppNumber(phone) ? 'Telefone inválido. Use DDD + número.' : null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Compartilhar no WhatsApp"
      footer={
        <>
          <Button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(msg)
                toast({ tone: 'ok', title: 'Mensagem copiada' })
              } catch {
                toast({ tone: 'erro', title: 'Não foi possível copiar', body: 'Selecione o texto e copie manualmente.' })
              }
            }}
          >
            <Copy className="h-4 w-4" /> Copiar mensagem
          </Button>
          <a
            href={url ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!url}
            onClick={(e) => !url && e.preventDefault()}
            className={`inline-flex h-10 items-center gap-2 rounded-md bg-[#1f9d55] px-4 font-semibold text-white hover:bg-[#178246] ${!url ? 'pointer-events-none opacity-45' : ''}`}
          >
            <MessageCircle className="h-4 w-4" /> Abrir WhatsApp <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="WhatsApp do cliente" error={phoneErr} hint={phone ? formatPhone(phone) : 'Nenhum telefone cadastrado'}>
          {(id) => <input id={id} className={inputCls(!!phoneErr)} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />}
        </Field>
        <Field label="Mensagem (editável)">
          {(id) => <textarea id={id} rows={6} className={`${inputCls()} h-auto py-2`} value={msg} onChange={(e) => setMsg(e.target.value)} />}
        </Field>
        <div className="rounded-md border border-line bg-surface-2 p-3 text-sm text-muted">
          <p>
            <strong className="text-ink">Abrir o WhatsApp não marca o orçamento como enviado.</strong> Depois de enviar, confirme o envio no orçamento.
          </p>
          <p className="mt-1">Para anexar a proposta, gere o PDF e envie o arquivo na conversa. O link seguro de compartilhamento do PDF é gerado quando o orçamento é registrado no servidor.</p>
        </div>
      </div>
    </Modal>
  )
}

export function ProposalModal({ open, onClose, data }: { open: boolean; onClose: () => void; data: ProposalData }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={data.preview ? 'Prévia da proposta' : 'Proposta comercial'}
      footer={
        <>
          {data.preview && <Badge tone="warn" className="mr-auto self-center">Há pendências: o PDF sai com marca d’água de prévia</Badge>}
          <Button onClick={onClose}>Fechar</Button>
          <Button variant="primary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimir / salvar PDF
          </Button>
        </>
      }
    >
      <div className="overflow-x-auto rounded bg-surface-2 p-2 sm:p-6">
        <ProposalDocument d={data} />
      </div>
      {open && createPortal(<div className="print-portal"><ProposalDocument d={data} /></div>, document.body)}
    </Modal>
  )
}
