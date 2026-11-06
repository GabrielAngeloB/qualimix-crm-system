/** Validação de CPF/CNPJ e utilitários de telefone/WhatsApp. */

export const onlyDigits = (s: string) => (s ?? '').replace(/\D/g, '')

export function isValidCPF(raw: string): boolean {
  const cpf = onlyDigits(raw)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const calc = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10])
}

export function isValidCNPJ(raw: string): boolean {
  const cnpj = onlyDigits(raw)
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false
  const calc = (len: number) => {
    const weights =
      len === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(cnpj[i]) * weights[i]
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13])
}

/** Retorna mensagem de erro ou null. Documento vazio é permitido. */
export function validateDocument(raw: string): string | null {
  const d = onlyDigits(raw)
  if (!d) return null
  if (d.length === 11) return isValidCPF(d) ? null : 'CPF inválido'
  if (d.length === 14) return isValidCNPJ(d) ? null : 'CNPJ inválido'
  return 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos)'
}

export function formatDocument(raw: string): string {
  const d = onlyDigits(raw)
  if (d.length === 11)
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (d.length === 14)
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return raw
}

export function formatPhone(raw: string): string {
  const d = onlyDigits(raw).replace(/^55(?=\d{10,11}$)/, '')
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return raw
}

/** Normaliza para o formato internacional usado pelo wa.me (55 + DDD + número). */
export function toWhatsAppNumber(raw: string): string | null {
  let d = onlyDigits(raw)
  if (d.length === 10 || d.length === 11) d = '55' + d
  if (!/^55\d{10,11}$/.test(d)) return null
  return d
}

export function whatsappUrl(phone: string, message: string): string | null {
  const n = toWhatsAppNumber(phone)
  if (!n) return null
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`
}
