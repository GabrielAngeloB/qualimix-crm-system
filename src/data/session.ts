export const localUserId = 'u-local'
export const localUserName = 'Sessão local'

export function displayUserName(id: string): string {
  if (!id || id === 'u-local' || id === 'u-adm') return localUserName
  return id
}
