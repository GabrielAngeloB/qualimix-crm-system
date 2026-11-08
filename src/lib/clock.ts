const current = new Date()

export const today = [
  current.getFullYear(),
  String(current.getMonth() + 1).padStart(2, '0'),
  String(current.getDate()).padStart(2, '0'),
].join('-')
