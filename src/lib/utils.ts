export function generateSimpleId() {
  // Ambil waktu saat ini dalam milidetik
  const timestamp = Date.now().toString(36); // Ubah ke basis 36 untuk string yang lebih pendek
  // Buat angka acak dan ubah juga ke basis 36
  const randomPart = Math.random().toString(36).substring(2, 9);

  return `${randomPart}`;
}
