"""Integration checks against a running instance; creates and removes its own test folder."""
import io
import json
import os
import sys
import uuid
import zipfile
import urllib.request
import urllib.error
import http.cookiejar

base = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8080'
cookies = http.cookiejar.CookieJar()
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))

def request(method, route, data=None, content_type='application/json', expected=200):
    raw = json.dumps(data).encode() if isinstance(data, dict) else data
    req = urllib.request.Request(base + '/api' + route, data=raw, method=method,
                                 headers={'Content-Type': content_type, 'Origin': base})
    try:
        response = client.open(req, timeout=180)
    except urllib.error.HTTPError as error:
        response = error
    body = response.read()
    assert response.status == expected, (route, response.status, body.decode(errors='replace'))
    return body, response.headers

def get(route):
    return json.loads(request('GET', route)[0])

def upload(category, filename, content, title, tags):
    boundary = uuid.uuid4().hex
    parts = []
    for name, value in {'categoryId': category, 'title': title, 'tags': tags}.items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode() + content + b'\r\n')
    parts.append(f'--{boundary}--\r\n'.encode())
    return json.loads(request('POST', '/documents', b''.join(parts), f'multipart/form-data; boundary={boundary}', 201)[0])['id']

def docx():
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        archive.writestr('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        archive.writestr('word/document.xml', '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Проверка конвертации регламента</w:t></w:r></w:p><w:sectPr/></w:body></w:document>')
    return output.getvalue()

def pdf():
    objects = [b'<< /Type /Catalog /Pages 2 0 R >>', b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>', b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>', b'<< /Length 0 >>\nstream\n\nendstream']
    data = b'%PDF-1.4\n'
    offsets = [0]
    for i, obj in enumerate(objects, 1):
        offsets.append(len(data))
        data += f'{i} 0 obj\n'.encode() + obj + b'\nendobj\n'
    start = len(data)
    data += b'xref\n0 5\n0000000000 65535 f \n'
    data += b''.join(f'{offset:010d} 00000 n \n'.encode() for offset in offsets[1:])
    return data + f'trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n{start}\n%%EOF'.encode()

root = None
try:
    assert get('/health')['ok']
    request('POST', '/categories', {'name': 'Denied'}, expected=401)
    request('POST', '/auth/login', {'username': os.getenv('ADMIN_USERNAME', 'admin'), 'password': os.getenv('ADMIN_PASSWORD', 'admin123')})
    assert get('/auth/me')['username']
    root = json.loads(request('POST', '/categories', {'name': 'Smoke ' + uuid.uuid4().hex}, expected=201)[0])['id']
    child = json.loads(request('POST', '/categories', {'name': 'Child', 'parentId': root}, expected=201)[0])['id']
    request('PATCH', '/categories/' + child, {'name': 'Renamed child'})
    original = pdf()
    pdf_id = upload(child, 'test.pdf', original, 'Smoke PDF', 'smoke, test')
    word_id = upload(child, 'test.docx', docx(), 'Smoke DOCX', 'smoke')
    assert len(get('/documents?categoryId=' + child + '&search=sMoKe&tag=smoke')) == 2
    assert request('GET', '/documents/' + pdf_id + '/download')[0] == original
    for identity in (pdf_id, word_id):
        content, headers = request('GET', '/documents/' + identity + '/preview')
        assert content.startswith(b'%PDF-')
        assert headers['Content-Disposition'].startswith('inline')
    tree = get('/categories/tree')
    assert next(n for n in tree if n['id'] == root)['count'] == 2
    request('DELETE', '/documents/' + pdf_id)
    request('GET', '/documents/' + pdf_id + '/preview', expected=404)
    request('DELETE', '/categories/' + root)
    root = None
    request('GET', '/documents/' + word_id + '/preview', expected=404)
    assert not get('/documents?categoryId=' + child)
    request('POST', '/auth/logout')
    request('GET', '/auth/me', expected=401)
    print('PASS: auth, protection, category CRUD, PDF/DOCX upload, conversion, filters, counts, download, cascade deletion, logout')
finally:
    if root:
        request('DELETE', '/categories/' + root)
