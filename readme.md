# 단어 유사도 추측 게임

이 레포지터리는 NewsJelly의 [semantle-ko](http://semantlich.johannesgaetjen.de/)
([소스코드](https://github.com/NewsJelly/semantle-ko))를 포크하여,
매일이 아닌, 연속적으로 플레이할 수 있도록 수정한 것입니다.

### Setup

Download Word2Vec and dictionary data:
```bash
cd data
wget https://dl.fbaipublicfiles.com/fasttext/vectors-crawl/cc.ko.300.vec.gz
gzip -d cc.ko.300.vec.gz
wget https://github.com/spellcheck-ko/hunspell-dict-ko/releases/download/0.7.92/ko-aff-dic-0.7.92.zip
unzip ko-aff-dic-0.7.92.zip
```

Filter and save word2vec in DB
```bash
docker-compose run --rm --entrypoint python app filter_words.py
docker-compose run --rm --entrypoint python app process_vecs.py
```

(Optional) Regenerate secrets
```bash
docker-compose run --rm --entrypoint python app generate_secrets.py
```

Start server
```bash
docker-compose up
```
