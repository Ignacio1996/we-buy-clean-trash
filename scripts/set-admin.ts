import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from './_admin';

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: npm run set-admin -- <uid-or-email>');
    process.exit(1);
  }

  const user = arg.includes('@')
    ? await adminAuth.getUserByEmail(arg)
    : await adminAuth.getUser(arg);

  await adminAuth.setCustomUserClaims(user.uid, { role: 'admin' });
  console.log(`✓ role=admin claim set on ${user.uid} (${user.email ?? 'no email'})`);

  const userRef = adminDb.collection('users').doc(user.uid);
  const snap = await userRef.get();
  if (snap.exists) {
    await userRef.update({ role: 'admin', updatedAt: FieldValue.serverTimestamp() });
    console.log('✓ users/' + user.uid + ' doc updated');
  } else {
    console.log('ℹ no users/' + user.uid + ' doc yet — claim alone is enough for auth checks');
  }

  console.log(
    '\nThe user must sign out and back in (or call getIdToken(true)) before the new claim takes effect.',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
