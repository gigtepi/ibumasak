*(Typing the `/` automatically creates the `api` folder for you!)*
4. Now, move down to the file editor box and **paste the following backend code**:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { status, billExternalReferenceNo } = req.body;

  if (status === '1' || status === 1) {
    const userEmail = billExternalReferenceNo; 

    if (userEmail) {
      try {
        const { data: { users }, error: adminError } = await supabase.auth.admin.listUsers();
        if (adminError) throw adminError;

        const targetUser = users.find(u => u.email === userEmail);

        if (targetUser) {
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + 30);

          const { error: updateError } = await supabase
            .from('profiles')
            .update({ 
              is_subscribed: true,
              subscription_end: expiryDate.toISOString()
            })
            .eq('id', targetUser.id);

          if (updateError) throw updateError;
          return res.status(200).send('OK');
        }
      } catch (err) {
        console.error('Callback processing error:', err);
        return res.status(500).json({ error: 'Internal database update failed' });
      }
    }
  }
  return res.status(400).send('Transaction unverified or missing profile reference.');
}
