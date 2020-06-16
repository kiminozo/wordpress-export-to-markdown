const encoded = "\\[trans\\]こんにちは。私のここ１ヶ月は慌しい毎日でした。でも、やっと音楽生活の話ができて嬉しいです。"



let content = encoded;
console.log(content)
content = content.replace("\\[trans\\]", '');
console.log("------------")
console.log(content)


