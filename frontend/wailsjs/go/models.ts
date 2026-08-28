export namespace main {

	export class InstallCommand {
	    manager: string;
	    command: string;

	    static createFrom(source: any = {}) {
	        return new InstallCommand(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.manager = source["manager"];
	        this.command = source["command"];
	    }
	}
	export class Tool {
	    name: string;
	    version: string;
	    install: string;
	    category: string;
	    languages: string[];
	    available: boolean;
	    commands: InstallCommand[];

	    static createFrom(source: any = {}) {
	        return new Tool(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.version = source["version"];
	        this.install = source["install"];
	        this.category = source["category"];
	        this.languages = source["languages"];
	        this.available = source["available"];
	        this.commands = this.convertValues(source["commands"], InstallCommand);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Repo {
	    name: string;
	    owner: string;
	    fullName: string;
	    path: string;
	    branch: string;
	    language: string;
	    updated: string;
	    githubUrl: string;
	    description: string;

	    static createFrom(source: any = {}) {
	        return new Repo(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.owner = source["owner"];
	        this.fullName = source["fullName"];
	        this.path = source["path"];
	        this.branch = source["branch"];
	        this.language = source["language"];
	        this.updated = source["updated"];
	        this.githubUrl = source["githubUrl"];
	        this.description = source["description"];
	    }
	}
	export class Config {
	    workspace: string;
	    editor: string;
	    theme: string;
	    glow: number;
	    radius: number;
	    glass: number;

	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.workspace = source["workspace"];
	        this.editor = source["editor"];
	        this.theme = source["theme"];
	        this.glow = source["glow"];
	        this.radius = source["radius"];
	        this.glass = source["glass"];
	    }
	}
	export class Bootstrap {
	    config: Config;
	    repos: Repo[];
	    tools: Tool[];
	    platform: string;
	    version: string;
	    error: string;

	    static createFrom(source: any = {}) {
	        return new Bootstrap(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.config = this.convertValues(source["config"], Config);
	        this.repos = this.convertValues(source["repos"], Repo);
	        this.tools = this.convertValues(source["tools"], Tool);
	        this.platform = source["platform"];
	        this.version = source["version"];
	        this.error = source["error"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Commit {
	    hash: string;
	    short: string;
	    subject: string;
	    author: string;
	    date: string;
	    graph: string;
	    connectors: string[];
	    refs: string;
	    parents: string[];

	    static createFrom(source: any = {}) {
	        return new Commit(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hash = source["hash"];
	        this.short = source["short"];
	        this.subject = source["subject"];
	        this.author = source["author"];
	        this.date = source["date"];
	        this.graph = source["graph"];
	        this.connectors = source["connectors"];
	        this.refs = source["refs"];
	        this.parents = source["parents"];
	    }
	}

	export class ContributorStat {
	    name: string;
	    email: string;
	    commits: number;
	    percent: number;

	    static createFrom(source: any = {}) {
	        return new ContributorStat(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.email = source["email"];
	        this.commits = source["commits"];
	        this.percent = source["percent"];
	    }
	}
	export class Document {
	    path: string;
	    name: string;
	    language: string;
	    html: string;
	    source: string;
	    size: number;
	    lines: number;
	    markdown: boolean;
	    binary: boolean;

	    static createFrom(source: any = {}) {
	        return new Document(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.name = source["name"];
	        this.language = source["language"];
	        this.html = source["html"];
	        this.source = source["source"];
	        this.size = source["size"];
	        this.lines = source["lines"];
	        this.markdown = source["markdown"];
	        this.binary = source["binary"];
	    }
	}

	export class LanguageStat {
	    name: string;
	    files: number;
	    bytes: number;
	    percent: number;

	    static createFrom(source: any = {}) {
	        return new LanguageStat(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.files = source["files"];
	        this.bytes = source["bytes"];
	        this.percent = source["percent"];
	    }
	}
	export class LintDiagnostic {
	    linter: string;
	    path: string;
	    line: number;
	    column: number;
	    severity: string;
	    message: string;

	    static createFrom(source: any = {}) {
	        return new LintDiagnostic(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.linter = source["linter"];
	        this.path = source["path"];
	        this.line = source["line"];
	        this.column = source["column"];
	        this.severity = source["severity"];
	        this.message = source["message"];
	    }
	}
	export class LintReport {
	    linter: string;
	    diagnostics: LintDiagnostic[];
	    output: string;
	    error: string;

	    static createFrom(source: any = {}) {
	        return new LintReport(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.linter = source["linter"];
	        this.diagnostics = this.convertValues(source["diagnostics"], LintDiagnostic);
	        this.output = source["output"];
	        this.error = source["error"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class LinterInfo {
	    name: string;
	    available: boolean;
	    install: string;
	    commands: InstallCommand[];

	    static createFrom(source: any = {}) {
	        return new LinterInfo(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.available = source["available"];
	        this.install = source["install"];
	        this.commands = this.convertValues(source["commands"], InstallCommand);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PullRequest {
	    number: number;
	    title: string;
	    author: string;
	    state: string;
	    draft: boolean;
	    updated: string;
	    url: string;
	    headBranch: string;
	    baseBranch: string;

	    static createFrom(source: any = {}) {
	        return new PullRequest(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.number = source["number"];
	        this.title = source["title"];
	        this.author = source["author"];
	        this.state = source["state"];
	        this.draft = source["draft"];
	        this.updated = source["updated"];
	        this.url = source["url"];
	        this.headBranch = source["headBranch"];
	        this.baseBranch = source["baseBranch"];
	    }
	}

	export class RepositorySources {
	    yours: Repo[];
	    organisations: Repo[];
	    starred: Repo[];
	    error: string;

	    static createFrom(source: any = {}) {
	        return new RepositorySources(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.yours = this.convertValues(source["yours"], Repo);
	        this.organisations = this.convertValues(source["organisations"], Repo);
	        this.starred = this.convertValues(source["starred"], Repo);
	        this.error = source["error"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RepositoryStats {
	    commits: number;
	    branches: number;
	    contributors: number;
	    files: number;
	    lines: number;
	    bytes: number;
	    firstCommit: string;
	    lastCommit: string;
	    languages: LanguageStat[];
	    contributorsByIdentity: ContributorStat[];

	    static createFrom(source: any = {}) {
	        return new RepositoryStats(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.commits = source["commits"];
	        this.branches = source["branches"];
	        this.contributors = source["contributors"];
	        this.files = source["files"];
	        this.lines = source["lines"];
	        this.bytes = source["bytes"];
	        this.firstCommit = source["firstCommit"];
	        this.lastCommit = source["lastCommit"];
	        this.languages = this.convertValues(source["languages"], LanguageStat);
	        this.contributorsByIdentity = this.convertValues(source["contributorsByIdentity"], ContributorStat);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ScannerInfo {
	    name: string;
	    available: boolean;
	    install: string;
	    commands: InstallCommand[];

	    static createFrom(source: any = {}) {
	        return new ScannerInfo(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.available = source["available"];
	        this.install = source["install"];
	        this.commands = this.convertValues(source["commands"], InstallCommand);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SearchResult {
	    path: string;
	    line: number;
	    preview: string;
	    kind: string;

	    static createFrom(source: any = {}) {
	        return new SearchResult(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.line = source["line"];
	        this.preview = source["preview"];
	        this.kind = source["kind"];
	    }
	}

	export class TreeEntry {
	    name: string;
	    path: string;
	    kind: string;
	    size: number;

	    static createFrom(source: any = {}) {
	        return new TreeEntry(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.kind = source["kind"];
	        this.size = source["size"];
	    }
	}

}

