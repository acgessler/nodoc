
from nodoc import Processor

import re

rex = {
	# matches a javadoc comment on top of a class, along with the class declaration
	'java-class-head': r"""
		\/\*\*		# start of multiline comment
		(.*?)		# actual comment
		\*\/\s*		# end of multiline comment

		(public|private|protected|)\s+	# java access specifier
		(abstract|final|)\s+			# java abstract and final (which are mutually exclusive)
		(class|interface)\s+			# class or interface specifier
		(\w+?)\s"""						# name of class or interface

	# matches a javadoc comment on top of a method, along with the method declaration
	, 'java-method-head' : r""" 
		\/\*\*		# start of multiline comment
		(.*?)		# actual comment
		\*\/\s*		# end of multiline comment

		(public|private|protected|)\s+	# java access specifier
		(abstract|final|)\s+			# java abstract and final (which are mutually exclusive)
		(.*?)\s+						# return type, cannot be tackled with a regex
		(\w+?)\s+						# name of the function
		\(\s+ 							# opening parameter block parentheses
			(.*?)						# list of parameters, cannot be tackled with a regex
		\s+\)							# closing parameter block parentheses
	"""
}


for k in list(rex.keys()):
	rex[k] = re.compile(rex[k], re.DOTALL | re.VERBOSE)



class JavaMethod:
	def __init__(self, name, return_type, unparsed_parameter_block):
		self.name = name
		self.return_type = return_type.strip()
		self.parameters = JavaMethod.parse_parameters(unparsed_parameter_block)

	@staticmethod
	def parse_parameters(unparsed_parameter_block):
		return []


class JavaClass:
	def __init__(self):
		self.methods = {}

	def add_method(self, method):
		self.methods[method]


class JavaProcessor(Processor):
	
	def __init__(self):
		Processor.__init__(self)


	def add_to_docset(self, fullpath):
		print('Processing ' + fullpath)
		with open(fullpath, 'rt') as inp:
			buffer = inp.read()

			matches = []
			for match in re.finditer(rex['java-class-head'], buffer):
				groups = match.groups()
				self.symbols.add(groups[-1])
				matches.append(match)
			
			self.docset[fullpath] = matches


	def generate_doc(self, output_folder):
		import os

		for fullpath, matched in self.docset.items():
			for match in matched:
				self.write_class_doc(match, output_folder)


	def write_class_doc(self, match, output_folder):
		block, access_spec, abstract_final_spec, class_interface_spec, class_name = match.groups()
		if len(block) == 0:
			return

		lines = [line.strip() for line in block.split('\n') if len(line.strip()) > 0]
		lines = [line[1:] if line[0] == '*' else line for line in lines]
		block = '\n'.join(lines)

		block = re.sub(r'@author(.*?)$',r'Authors: __\1__', block)
		block = re.sub(r'\b(' + '|'.join(self.symbols)+r')\b',r'__\1__', block)

		import markdown
		block = markdown.markdown( 
r"""<font size="-1"> {access_spec} {abstract_final_spec} {class_interface_spec} </font> {class_name} 
---------------

{block}
""".format(**locals()))

		matched = re.findall(rex['java-method-head'], block)
		for m in matched:
			print m.groups()

		# github css for testing
		css = r'<link href="https://gist.github.com/andyferra/2554919/raw/2e66cabdafe1c9a7f354aa2ebf5bc38265e638e5/github.css" rel="stylesheet"></link>'

		import os.path
		with open(os.path.join(output_folder,class_name + ".html"), 'wt') as outp:
			outp.write(css + block)

