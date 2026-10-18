"""Minimal, exact HTML -> JSX converter for the Dugo+ mockup markup.

The mockup HTML is generated and regular (quoted attributes, explicit closing tags,
no comments, no raw ampersands, no `>` inside attribute values), so a tag-level
transform keeps the output byte-faithful in rendering: output stays on a single
line so JSX never trims significant whitespace.
"""
import re

VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
        'meta', 'param', 'source', 'track', 'wbr'}

NAME_MAP = {
    'class': 'className', 'for': 'htmlFor', 'tabindex': 'tabIndex',
    'readonly': 'readOnly', 'maxlength': 'maxLength', 'minlength': 'minLength',
    'colspan': 'colSpan', 'rowspan': 'rowSpan', 'autocomplete': 'autoComplete',
    'autofocus': 'autoFocus', 'enctype': 'encType', 'srcset': 'srcSet',
    'crossorigin': 'crossOrigin', 'contenteditable': 'contentEditable',
    'spellcheck': 'spellCheck', 'inputmode': 'inputMode',
    'referrerpolicy': 'referrerPolicy', 'datetime': 'dateTime',
    'formaction': 'formAction', 'novalidate': 'noValidate',
    'allowfullscreen': 'allowFullScreen', 'checked': 'defaultChecked',
}

BOOL_ATTRS = {'disabled', 'required', 'readonly', 'hidden', 'open', 'multiple',
              'autofocus', 'novalidate', 'controls', 'loop', 'muted', 'default',
              'inert', 'selected'}

TAG_RE = re.compile(r'</?([A-Za-z][\w:-]*)((?:"[^"]*"|\'[^\']*\'|[^>"\'])*?)(/?)>', re.S)
ATTR_RE = re.compile(r'([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|\'([^\']*)\'))?')


def camel(name: str) -> str:
    return re.sub(r'-([a-z])', lambda m: m.group(1).upper(), name)


def jsx_name(name: str) -> str:
    if name in NAME_MAP:
        return NAME_MAP[name]
    if name.startswith(('data-', 'aria-', 'xmlns')):
        return name
    return camel(name)


def style_object(value: str) -> str:
    parts = []
    for decl in value.split(';'):
        decl = decl.strip()
        if not decl:
            continue
        key, _, val = decl.partition(':')
        key, val = key.strip(), val.strip()
        assert '{' not in val and '}' not in val, value
        if key.startswith('--'):
            parts.append(f'"{key}": "{val}"')
        else:
            parts.append(f'{camel(key)}: "{val}"')
    return '{ ' + ', '.join(parts) + ' }'


def convert_attrs(tag: str, raw: str) -> str:
    out = []
    for m in ATTR_RE.finditer(raw):
        name, v1, v2 = m.group(1), m.group(2), m.group(3)
        value = v1 if v1 is not None else v2
        assert '{' not in (value or '') and '}' not in (value or ''), raw
        has_value = value is not None
        if name == 'style' and has_value:
            out.append(f'style={style_object(value)}')
            continue
        if name in BOOL_ATTRS and (not has_value or value == ''):
            out.append(jsx_name(name))
            continue
        if name == 'value' and tag in ('input', 'select', 'textarea'):
            name = 'defaultValue'
        jname = jsx_name(name)
        if not has_value:
            out.append(jname)
        else:
            out.append(f'{jname}="{value}"')
    return (' ' + ' '.join(out)) if out else ''


def escape_text(text: str) -> str:
    return text.replace('{', "{'{'}").replace('}', "{'}'}")


def convert(fragment: str) -> str:
    """Convert an HTML fragment (no <style>/<script>) to single-line JSX."""
    out, pos = [], 0
    stack = []
    for m in TAG_RE.finditer(fragment):
        text = fragment[pos:m.start()]
        if text:
            out.append(escape_text(text))
        closing = m.group(0).startswith('</')
        tag, raw, selfclose = m.group(1), m.group(2), m.group(3)
        if closing:
            out.append(f'</{tag}>')
            if stack and stack[-1] == tag:
                stack.pop()
            pos = m.end()
            continue
        if tag == 'textarea':
            # <textarea ...>content</textarea> -> defaultValue
            end = fragment.index('</textarea>', m.end())
            inner = fragment[m.end():end]
            attrs = convert_attrs(tag, raw)
            if inner:
                attrs += f' defaultValue="{inner}"'
            out.append(f'<textarea{attrs} />')
            pos = end + len('</textarea>')
            continue
        attrs = convert_attrs(tag, raw)
        if tag in VOID or selfclose:
            out.append(f'<{tag}{attrs} />')
        else:
            out.append(f'<{tag}{attrs}>')
            stack.append(tag)
        pos = m.end()
    tail = fragment[pos:]
    if tail:
        out.append(escape_text(tail))
    assert not stack, f'unbalanced tags: {stack[:5]}'
    return ''.join(out)


def strip_scripts(fragment: str) -> str:
    return re.sub(r'<script[^>]*>.*?</script>', '', fragment, flags=re.S)
