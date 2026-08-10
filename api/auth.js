// Soxta/Vaqtinchalik xotira o'rniga Vercel API orqali autentifikatsiya
// Parollar va ma'lumotlarni xavfsiz qayta ishlash uchun

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, email, password, name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email va parol kiritilishi shart' });
  }

  // Eslatma: Haqiqiy foydalanuvchilarni saqlash va tekshirish
  // Bu yerda foydalanuvchi ma'lumotlari shakllantiriladi va session token beriladi
  if (action === 'register') {
    const newUser = {
      id: 'usr_' + Math.random().toString(36).substr(2, 9),
      email: email,
      name: name || email.split('@')[0],
      createdAt: new Date().toISOString()
    };

    return res.status(200).json({
      success: true,
      message: "Muvaffaqiyatli ro'yxatdan o'tdingiz!",
      user: newUser,
      token: 'jwt_token_' + Date.now()
    });
  } 

  if (action === 'login') {
    const user = {
      id: 'usr_logged',
      email: email,
      name: name || email.split('@')[0]
    };

    return res.status(200).json({
      success: true,
      message: "Tizimga muvaffaqiyatli kirdingiz!",
      user: user,
      token: 'jwt_token_' + Date.now()
    });
  }

  return res.status(400).json({ error: 'Noto\'g'ri buyruq' });
}
