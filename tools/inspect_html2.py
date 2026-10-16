import re, subprocess, collections

def body_of(rel):
    return subprocess.check_output(['git', 'show', f'HEAD:{rel}'], text=True).split('</style>', 1)[1]

files = ['light/admin-blood-requests.html', 'light/admin-donor-registry.html',
         'light/admin-settings.html', 'light/landing.html', 'light/admin-donations-rewards.html',
         'light/admin-donor-matching.html']

for rel in files:
    b = body_of(rel)
    print('=' * 20, rel)
    print('inline styles:')
    for m in list(re.finditer(r'<[a-z]+[^>]*?style="[^"]*"[^>]*>', b))[:4]:
        print('   ', m.group(0)[:150])
    print('boolean attrs:')
    for m in list(re.finditer(r'<[a-z]+[^>]*?\s(?:disabled|checked|selected|required|readonly|hidden|open)(?:=[^ >]*)?[^>]*>', b))[:4]:
        print('   ', m.group(0)[:150])
    print('input/select/textarea value:')
    for m in list(re.finditer(r'<(?:input|select|textarea)[^>]*>', b))[:6]:
        print('   ', m.group(0)[:150])
    print('textarea block:')
    for m in list(re.finditer(r'<textarea[^>]*>.*?</textarea>', b, re.S))[:3]:
        print('   ', m.group(0)[:150])
    print('option selected:')
    for m in list(re.finditer(r'<option[^>]*selected[^>]*>[^<]*</option>', b))[:3]:
        print('   ', m.group(0)[:150])
    print('br:')
    for m in list(re.finditer(r'<br[^>]*>', b))[:3]:
        print('   ', m.group(0))
    print()
