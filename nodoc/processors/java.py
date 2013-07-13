

import re

rex = {
	'java-class-head': r"""\/\*\*(.*?)\*\/\s*
		(public|private|protected|)\s?
		(abstract|final)?\s+
		(class|interface)\s+
		(\w+?)\s"""
}


for k in list(rex.keys()):
	rex[k] = re.compile(rex[k], re.DOTALL | re.VERBOSE)



class JavaProcessor:
	
	def __init__(self):
		self.docset = {}
		self.classnames = set()	


	def add_to_docset(self, fullpath):
		print('Processing ' + fullpath)
		with open(fullpath, 'rt') as inp:
			buffer = inp.read()
			matched = re.findall(rex['java-class-head'], buffer)

			for m in matched:
				self.classnames.add(m[-1])
			self.docset[fullpath] = matched

	def generate_doc(self, output_folder):
		import os
		
		for fullpath, matched in self.docset.items():
			for match in matched:
				block, access_spec, abstract_final_spec, class_interface_spec, class_name = match
				if len(block) == 0:
					continue

				lines = [line.strip() for line in block.split('\n') if len(line.strip()) > 0]
				lines = [line[1:] if line[0] == '*' else line for line in lines]
				block = '\n'.join(lines)

				block = re.sub(r'@author(.*?)$',r'Authors: __\1__', block)
				block = re.sub(r'\b(' + '|'.join(self.classnames)+r')\b',r'__\1__', block)

				import markdown
				block = markdown.markdown( 
r"""<font size="-1"> {access_spec} {abstract_final_spec} {class_interface_spec} </font> {class_name}
---------------

{block}

""".format(**locals()))

				# github css for testing
				css = r'<link href="https://gist.github.com/andyferra/2554919/raw/2e66cabdafe1c9a7f354aa2ebf5bc38265e638e5/github.css" rel="stylesheet"></link>'

				with open(os.path.join(output_folder,class_name + ".html"), 'wt') as outp:
					outp.write(css + block)

