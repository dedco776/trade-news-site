import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { amount, userId, email } = req.body;

    if (!amount || amount < 5) {
        return res.status(400).json({ error: 'Eng kam toʻlov miqdori $5' });
    }

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'DEDCO TRADING - Real Wallet Top Up',
                            description: `User: ${email} hisobini to'ldirish`,
                        },
                        unit_amount: Math.round(amount * 100), // USD cents
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${req.headers.origin}?payment=success&amt=${amount}`,
            cancel_url: `${req.headers.origin}?payment=cancel`,
            metadata: {
                userId: userId,
                email: email
            }
        });

        return res.status(200).json({ url: session.url });
    } catch (err) {
        console.error("Stripe Error:", err);
        return res.status(500).json({ error: err.message });
    }
}
