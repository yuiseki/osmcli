# PRD: osmable

## 1. 概要

osmable は、OpenStreetMap 由来のジオコーディング・OSM要素検索・ルーティングを、非対話・安定I/OのCLIとして束ね、コーディングAIエージェントが繰り返し呼び出して合成できるようにするツールです。

初期の主眼は、 yuiseki がセルフホストしている Nominatim / Overpass API / Valhalla API を、AIエージェントが迷わず活用できる形にすることです。
同時に、将来は任意のジオコーディングAPI/ルーティングAPIへ差し替え可能なプロダクト概念を保ちます（ただしMVPでは OSMプロファイルが主役）。

プロダクトのキャッチ:

- OSM系クエリを、1行で確実に返す
- 対話しない。stdoutはデータ、stderrはログ
- 曖昧さを扱う。失敗を機械的に扱う

## 2. 背景と課題

コーディングAIエージェントは、外部APIを直接叩くよりも、以下を満たす「道具」を好みます。

- 出力形式が固定で、パースに失敗しない
- エラーが分類され、再試行や代替策が立てやすい
- 小さなコマンドを組み合わせて大きなタスクを実現できる

一方、Nominatim/Overpass/Valhalla はそれぞれ強力ですが、組み合わせて使う際に都度API仕様を理解し、リクエスト・整形・再試行・曖昧性解消を実装する必要があり、AIエージェントにとっては摩擦が大きい状態です。

osmable は、この摩擦を取り除き、AIエージェントが「地名→領域(AOI)→POI集計/抽出→移動/到達圏」といった一連の地理タスクを、短いコマンド列で確実に遂行できる状態を作ります。

## 3. 目的

### 3.1 プロダクトゴール

- AIエージェントが、OSM由来の地理タスクを非対話CLIで安定実行できる
- AOI（地名や境界）を中心に、POI検索/集計とルーティングを最小の手間で合成できる
- 「これ欲しかった」と言われる片鱗をMVPで示す（ただし風呂敷を広げすぎない）

### 3.2 yuiseki の個人ゴール

- セルフホストした Nominatim / Overpass / Valhalla の価値を、日々の作業や検証で即回収できる
- AIエージェントの作業ループに組み込める（リトライ、分岐、パイプ、キャッシュが効く）

## 4. 非目標（スコープ外）

- フル機能のSPARQL/GeoSPARQLエンジンの実装
- GUI/TUIの提供（対話的UIは原則提供しない）
- 大規模な可視化、地図レンダリング、タイル生成などの重い周辺機能
- OSM全データのローカルDBインポートを必須とする設計
- 複数プロバイダ対応をMVPの要件にしない（将来の拡張余地としては保持）

## 5. 想定ユーザー

- コーディングAIエージェント（最重要）
- AIエージェントを運用する開発者・プロダクト開発者
- GIS/地理データを扱うエンジニア（簡単な問い合わせ・検証用途）

## 6. 主要ユースケース

### UC1: 地名から座標とbboxを得る（AIの初手）

- 入力: 地名
- 出力: lat/lon、bbox、正規化された表示名、候補情報

例:

- osmable geocode "東京都台東区" --format json
- osmable reverse --lat 35.6768601 --lon 139.7638947 --format json

### UC2: 地名から行政界（AOI）をGeoJSONで得る

- 入力: 地名（例: 東京都、台東区）
- 出力: AOIのGeoJSON Feature（またはFeatureCollection）

例:

- osmable aoi resolve "東京都台東区" --format geojson

### UC3: AOI内のPOIを数える（話題の核）

- 入力: POI指定（OSMタグまたはプリセット）、AOI指定（地名またはGeoJSON）
- 出力: 件数（および任意でメタ情報）

例:

- osmable poi count --tag amenity=cafe --within "東京都台東区" --format json
- osmable poi count --preset cafe --within @aoi.geojson --format json

### UC4: AOI内のPOIを取得して次の処理へ渡す

- 入力: POI指定、AOI指定
- 出力: POIのGeoJSON/NDJSON

例:

- osmable poi fetch --preset cafe --within "東京都台東区" --format geojson
- osmable poi fetch --tag amenity=cafe --within @aoi.geojson --format ndjson | jq ...

### UC5: 移動の最短経路・到達圏を得る（片鱗の演出）

- 入力: from/to（地名または座標）
- 出力: 経路（json）または到達圏（geojson）

例:

- osmable route --from "東京駅" --to "浅草寺" --mode pedestrian --format json
- osmable isochrone --from "東京駅" --minutes 10,20 --mode pedestrian --format geojson

### UC6: 到達圏内のPOI数（小さく強い合成）

- 入力: from、minutes、POI指定
- 出力: minutesごとの件数

例:

- osmable isochrone --from "東京駅" --minutes 10,20 --mode pedestrian --format geojson \
  | osmable poi count --preset cafe --within - --format json

## 7. プロダクト要件

### 7.1 共通の振る舞い要件（最重要）

1. 非対話

- 実行時に確認プロンプトを出さない
- 迷う場合はエラーとして返し、ユーザー/AIが引数で解決する

2. 標準入出力の規律

- stdout: データのみ
- stderr: ログ/警告/進捗（機械処理に混ぜない）

3. 出力形式の統一

- --format により少なくとも json / text / geojson / ndjson を選べる
- jsonはキーと型が安定している（破壊的変更はメジャーアップデート）
- textは最小・1行で扱いやすい（例: タブ区切り）

4. エラーの機械可読性

- 終了コードで少なくとも以下を区別する
  - 0: 成功
  - 入力不正
  - 結果なし
  - 上流APIのタイムアウト/一時失敗（リトライ可能）
  - 上流APIの恒久失敗
  - 曖昧すぎて決められない（候補提示は可能）
- --format json の場合、エラーもjsonで返せる（任意だが推奨）

5. 入口の一貫性

- --within は AOI 指定の統一インターフェイス
  - 地名
  - @file（GeoJSON）
  - -（stdin）
  - bbox指定（任意、MVPでは地名とGeoJSONを優先）

6. 設定可能な上流エンドポイント

- セルフホスト環境のURLを、引数または環境変数または設定で指定できる
- 利用者が「自分のOSMスタック」を簡単に指し替えられる

7. 冪等・再実行しやすい

- 同じ入力を繰り返しても同じスキーマで返る
- 連続実行で上流負荷と待ち時間を抑えられる（詳細手段はADRへ）

### 7.2 機能要件（サブコマンド）

#### A) geocode

- 地名クエリを受け取り、候補を返す
- 必須オプション
  - --limit（デフォルト1）
  - --format（デフォルトjson）
- 任意オプション
  - --lang / --country（結果安定化のため）
  - --all（候補をすべて返す）

受け入れ条件

- json出力に lat/lon/bbox/display_name が含まれる
- limit=1で決定的に1件返す（曖昧なら専用エラーまたは候補提示）

#### B) reverse

- lat/lonから住所相当を返す
- 受け入れ条件
  - json出力に display_name と主要住所要素が含まれる

#### C) aoi resolve

- 地名から境界ポリゴンを取得し、GeoJSONで返す
- 必須オプション
  - --format geojson が主（jsonでメタ情報のみも可）
- 受け入れ条件
  - GeoJSONが有効で、geometryがポリゴン系
  - propertiesに少なくとも name と由来メタ（source等）が入る

#### D) poi count

- tag または preset で指定したPOIを、--within 内で数える
- 必須オプション
  - --within
  - --tag または --preset
- 受け入れ条件
  - json出力に count が含まれる
  - withinが地名でもGeoJSONでも動く

#### E) poi fetch

- countと同じ入力で、POIをGeoJSON/NDJSONで返す
- 受け入れ条件
  - geojson: FeatureCollectionを返す
  - ndjson: 1行1Featureで返す

#### F) route（MVPでは最小）

- from/toから経路情報を返す
- 受け入れ条件
  - json出力に距離・時間・折れ線（または形状参照）が含まれる
  - from/toに地名を渡せる（内部で解決）

#### G) isochrone（MVPで入れる場合は最小）

- fromとminutes配列から到達圏ポリゴンを返す
- 受け入れ条件
  - geojsonでminutesごとのポリゴンが識別できる

#### H) doctor（運用性）

- 設定された上流エンドポイントに疎通し、簡易診断を返す
- 受け入れ条件
  - jsonで各サービスの到達可否と遅延目安を返す

### 7.3 プリセット要件（MVPは最小でよい）

- --preset を用意し、代表的なPOIを数個だけ提供する
- MVPプリセット案
  - cafe（amenity=cafe）
  - convenience（shop=convenience）
  - station（railway=station）
- 受け入れ条件
  - presetがtagへ解決され、poi count/fetchで使える

## 8. 体験設計（CLI UX）

- ヘルプは短く、例が多い
- 一貫したオプション命名
  - --format
  - --within
  - --limit
  - --tag / --preset
- ファイル入力は @file 記法を推奨（ただし通常のパス指定も許可）
- stdin入力は - を明示的に許可（--within - など）
- ログレベル切替（--quiet / --verbose）を用意（stderrのみ）

## 9. 成功指標（MVP）

プロダクトとしての成功

- AIエージェントが、UC1〜UC3をコマンド数少なく安定実行できる
- yuiseki が、日常的に aoi resolve と poi count/fetch を使う状態になる
- READMEの例をそのままコピペして成功する

話題性（初期の健全な狙い）

- 「自分のOSMスタックをAIが使えるようになる」点が一言で伝わる
- 到達圏→POI数の合成例が、SNSで共有しやすい短さになっている

## 10. リスクと対策（要求としての扱い）

- 曖昧な地名での誤解決
  - 対策: --limit=1のデフォルト、曖昧時のエラー分類、--allで候補提示
- AOI境界の巨大化・処理負荷
  - 対策: --simplify の提供は将来検討。MVPは警告と上限設定を要件化
- 上流APIの揺れ（タイムアウト等）
  - 対策: リトライ可能エラーの区別、タイムアウト/リトライのユーザー設定

## 11. マイルストーン

### M0: PRD確定とコマンド仕様の骨子

- 本PRD確定
- コマンド一覧、出力スキーマの草案、終了コード表の草案が揃う

成果物

- READMEの最小構成（コンセプト、インストール、例）
- --help の雛形

### M1: MVP（話題の核を作る）

MVPの範囲

- geocode
- reverse
- aoi resolve
- poi count
- poi fetch（geojson または ndjson のどちらかを必須、もう片方は可能なら）
- 共通要件（非対話、stdout/stderr規律、--format、--within、終了コード、設定）
- doctor

MVP受け入れ条件（必達のデモ）

- 地名→AOI→カフェ数が、3コマンド以内で再現できる
  - 例: osmable poi count --preset cafe --within "東京都台東区" --format json
- AOI GeoJSON を一度出力し、それを入力として再利用できる
  - 例: osmable aoi resolve "東京都台東区" --format geojson > aoi.geojson
    osmable poi count --preset cafe --within @aoi.geojson --format json

### M2: 片鱗の強化（小さく魅せる）

- route（最小）
- isochrone（最小、可能なら）
- preset 追加（数個まで）
- ドキュメント強化（AIエージェント向けのレシピ集）

この段階の狙い

- 到達圏→POI数の合成例を、READMEの看板にする

### M3: 公開品質（話題化の土台）

- 破壊的変更なしでスキーマ安定
- 例外系の整備（空結果、曖昧、タイムアウト）
- チュートリアルとレシピ（都市比較、密度、nearestの予告）
- 配布導線（どの配布形態にするかはADRで決定）

## 12. 将来の拡張（MVP外だが方向性は明示）

- poi nearest
- stats（group-by、上位N）
- density（count/areaの合成を公式化）
- coverage（isochrone + count のショートカット）
- 追加プロバイダプロファイル（ジオコーダ/ルータの差し替え）
- 出力スキーマのバージョニングと互換性ポリシーの明文化

以上
