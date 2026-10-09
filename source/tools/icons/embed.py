# Put icondata.json into the template as ICONDATA
t=open('../../template.html').read();i=t.index('const ICONDATA=');j=t.index(';\n',i)
open('../../template.html','w').write(t[:i]+'const ICONDATA='+open('icondata.json').read()+t[j:]);print('ICONDATA embedded')
