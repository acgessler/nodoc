

def main(config):

	import re
	import os.path 

	# set of valid characters in file names
	path_character_set = r'[a-zA-Z0-9_\-;,.|]'


	def regexify(pattern):
		# normalize path separators to unix
		pattern = pattern.replace('\\','/')

		# handle /?/ directory and * file wildcard
		pattern = re.escape(pattern) \
			.replace(r'\/\?\/',r'(.*[\\/])+?') \
			.replace(r'\*', path_character_set + r'+?') 
		
		pattern = '^' + pattern + '$'
		print pattern
		return re.compile(pattern)

	def unix_abs_path(path):
		return os.path.abspath(path).replace('\\','/')

	def split_path_prefix(path, prefix_matcher = re.compile(r'^((?:\w+\:[\\/])?(?:{0}+[\\/])*)({0}*?[*?]?.*)$'\
		.format(path_character_set))):

		match = re.match(prefix_matcher, path)
		print(match.groups())
		assert len(match.groups()) == 2
		return (unix_abs_path(match.group(1)), match.group(2))


	rex = {
		'java-class-head': r"""\/\*\*(.*?)\*\/\s*
			(public|private|protected|)\s?
			(abstract|final)?\s+
			(class|interface)\s+
			(\w+?)\s"""
	}


	for k in list(rex.keys()):
		rex[k] = re.compile(rex[k], re.DOTALL | re.VERBOSE)


	docset = {}
	classnames = set()

	def add_to_docset(fullpath):
		print('Processing ' + fullpath)
		with open(fullpath, 'rt') as inp:
			buffer = inp.read()
			matched = re.findall(rex['java-class-head'], buffer)

			for m in matched:
				classnames.add(m[-1])
			docset[fullpath] = matched

	def generate_doc():
		for fullpath, matched in docset.items():
			for match in matched:
				block, access_spec, abstract_final_spec, class_interface_spec, class_name = match
				if len(block) == 0:
					continue

				lines = [line.strip() for line in block.split('\n') if len(line.strip()) > 0]
				lines = [line[1:] if line[0] == '*' else line for line in lines]
				block = '\n'.join(lines)

				block = re.sub(r'@author(.*?)$',r'Authors: __\1__', block)
				block = re.sub(r'\b(' + '|'.join(classnames)+r')\b',r'__\1__', block)

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


	# create output folder
	output_folder = 'output'
	try:
		os.mkdir(output_folder)
	except:
		pass

	# process configuration file
	with open(config, 'rt') as inp:
		# take non-empty lines from config file, substitute placeholders by regular expressions
		patterns = (line.strip() for line in inp.readlines() if len(line.strip()) > 0 and line[0] != '#')
		patterns = [ split_path_prefix(p) for p in patterns ]
		
		from collections import defaultdict

		# find path prefixes to start searching with
		candidates = defaultdict(lambda: []) 
		for (prefix, suffix) in patterns:
			candidates[prefix].append(regexify(prefix + '/' + suffix))

		print(candidates)
		
		# recursively walk files, and match them against the input set
		for prefix, matchers in candidates.items():
			for (dirpath, dirnames, filenames) in os.walk(prefix):
				for filename in filenames:
					fullpath = unix_abs_path( os.path.join(dirpath, filename) )

					for matcher in matchers:
						match = matcher.match(fullpath)
						if match is None:
							continue

						add_to_docset(fullpath)
	generate_doc()



if __name__ == '__main__':
	main('doclist')