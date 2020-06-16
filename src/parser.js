const fs = require('fs');
const luxon = require('luxon');
const xml2js = require('xml2js');

const shared = require('./shared');
const translator = require('./translator');

async function parseFilePromise(config) {
	console.log('\nParsing...');
	const content = await fs.promises.readFile(config.input, 'utf8');
	const data = await xml2js.parseStringPromise(content, {
		trim: true,
		tagNameProcessors: [xml2js.processors.stripPrefix]
	});

	const posts = collectPosts(data, config);

	const images = [];
	if (config.saveAttachedImages) {
		images.push(...collectAttachedImages(data));
	}
	if (config.saveScrapedImages) {
		images.push(...collectScrapedImages(data));
	}

	mergeImagesIntoPosts(images, posts);

	return posts;
}

function getItemsOfType(data, type) {
	return data.rss.channel[0].item.filter(item => item.post_type[0] === type);
}

function collectPosts(data, config) {
	// this is passed into getPostContent() for the markdown conversion
	const turndownService = translator.initTurndownService();

	const posts = getItemsOfType(data, 'post')//, 'song'
		.filter(post => post.status[0] !== 'trash' && post.status[0] !== 'draft')
		.map(post => ({
			// meta data isn't written to file, but is used to help with other things
			meta: {
				id: getPostId(post),
				slug: getPostSlug(post),
				coverImageId: getPostCoverImageId(post),
				imageUrls: []
			},
			frontmatter: {
				title: getPostTitle(post),
				date: getPostDate(post),
				categories: getPostCategories(post),//["1"],
				tags: getPostTags(post),
				license: getLicense(post),
			},
			content: translator.getPostContent(post, turndownService, config)
		}));

	console.log(posts.length + ' posts found.');


	//SONG
	// const songs = getItemsOfType(data, 'song')//, 'song'
	// 	.filter(post => post.status[0] !== 'trash' && post.status[0] !== 'draft')
	// 	.map(post => ({
	// 		// meta data isn't written to file, but is used to help with other things
	// 		meta: {
	// 			id: getPostId(post),
	// 			slug: getPostSlug(post),
	// 			coverImageId: getPostCoverImageId(post),
	// 			imageUrls: []
	// 		},
	// 		frontmatter: {
	// 			title: getPostTitle(post),
	// 			date: getPostDate(post),
	// 			test: "1",
	// 			categories:["1"],
	// 			tags:["2","3"],
	// 		},
	// 		content: translator.getPostContent(post, turndownService, config)
	// 	}));

	// console.log(songs.length + ' songs found.');

	return [...posts];
}

function getPostId(post) {
	return post.post_id[0];
}

function getPostSlug(post) {
	return post.post_name[0];
}

function getPostCoverImageId(post) {
	if (post.postmeta === undefined) {
		return undefined;
	}

	const postmeta = post.postmeta.find(postmeta => postmeta.meta_key[0] === '_thumbnail_id');
	const id = postmeta ? postmeta.meta_value[0] : undefined;
	return id;
}

function getPostTitle(post) {
	return post.title[0];
}

function getPostDate(post) {
	return luxon.DateTime.fromRFC2822(post.pubDate[0], { zone: 'utc' }).toISODate();
}

function getPostCategories(post) {
	//<category domain="category" nicename="rain-or-shine"><![CDATA[Rain or Shine]]></category>
	const cates = post.category.filter(cate => cate["$"].domain === 'category')
		.map(cate => cate["_"])
	//console.log(JSON.stringify(cates));
	return cates;
	// return post.categories.filter(cate => cate.domain === 'category')
	// 	.map(cate => cate.meta_value[0]);
}

function getPostTags(post) {
	//<category domain="category" nicename="rain-or-shine"><![CDATA[Rain or Shine]]></category>
	const tags = post.category.filter(cate => cate["$"].domain === 'post_tag')
		.map(cate => cate["_"])
	//console.log(JSON.stringify(cates));
	return tags;
	// return post.categories.filter(cate => cate.domain === 'category')
	// 	.map(cate => cate.meta_value[0]);
}

function getLicense(post) {
	const license = {};
	post.postmeta.filter(meta => !meta.meta_key[0].startsWith('_'))
		.map(meta => license[meta.meta_key[0]] = meta.meta_value[0]);
	// const json = JSON.stringify(license);
	// const unquoted = json.replace(/"([^"]+)":/g, '$1:');
	// console.log(unquoted);
	return license;
}

function collectAttachedImages(data) {
	const images = getItemsOfType(data, 'attachment')
		// filter to certain image file types
		.filter(attachment => (/\.(gif|jpe?g|png)$/i).test(attachment.attachment_url[0]))
		.map(attachment => ({
			id: attachment.post_id[0],
			postId: attachment.post_parent[0],
			url: attachment.attachment_url[0]
		}));

	console.log(images.length + ' attached images found.');
	return images;
}

function collectScrapedImages(data) {
	const images = [];
	getItemsOfType(data, 'post').forEach(post => {
		const postId = post.post_id[0];
		const postContent = post.encoded[0];
		const postLink = post.link[0];

		const matches = [...postContent.matchAll(/<img[^>]*src="(.+?\.(?:gif|jpe?g|png))"[^>]*>/gi)];
		matches.forEach(match => {
			// base the matched image URL relative to the post URL
			const url = new URL(match[1], postLink).href;

			images.push({
				id: -1,
				postId: postId,
				url: url
			});
		});
	});

	console.log(images.length + ' images scraped from post body content.');
	return images;
}

function mergeImagesIntoPosts(images, posts) {
	// create lookup table for quicker traversal
	const postsLookup = posts.reduce((lookup, post) => {
		lookup[post.meta.id] = post;
		return lookup;
	}, {});

	images.forEach(image => {
		const post = postsLookup[image.postId];
		if (post) {
			if (image.id === post.meta.coverImageId) {
				// save cover image filename to frontmatter
				post.frontmatter.coverImage = shared.getFilenameFromUrl(image.url);
			}

			// save (unique) full image URLs for downloading later
			if (!post.meta.imageUrls.includes(image.url)) {
				post.meta.imageUrls.push(image.url);
			}
		}
	});
}

exports.parseFilePromise = parseFilePromise;
