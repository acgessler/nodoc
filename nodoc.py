from nodoc import *
from nodoc.processors import JavaProcessor

def main(config):

	import re
	import os.path 
	import shutil

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


	# create or clear output folder
	output_folder = 'output'
	try:
		os.mkdir(output_folder)
	except:
		pass

	processor = JavaProcessor()

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
		
		# recursively walk files, and match them against the input set
		for prefix, matchers in candidates.items():
			for (dirpath, dirnames, filenames) in os.walk(prefix):
				for filename in filenames:
					fullpath = unix_abs_path( os.path.join(dirpath, filename) )

					for matcher in matchers:
						match = matcher.match(fullpath)
						if match is None:
							continue

						processor.add_to_docset(fullpath)
	processor.generate_json_doc(output_folder)



if __name__ == '__main__':
	main('doclist')