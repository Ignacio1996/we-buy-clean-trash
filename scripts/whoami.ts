import { adminAuth, adminDb } from './_admin';

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: npm run whoami -- <uid-or-email>');
    process.exit(1);
  }

  const user = arg.includes('@')
    ? await adminAuth.getUserByEmail(arg)
    : await adminAuth.getUser(arg);

  console.log('uid         :', user.uid);
  console.log('email       :', user.email);
  console.log('customClaims:', user.customClaims ?? '(none)');

  const snap = await adminDb.collection('users').doc(user.uid).get();
  console.log('users doc   :', snap.exists ? snap.data() : '(missing)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
